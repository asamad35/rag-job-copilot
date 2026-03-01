import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright"

const defaultTargetsPath = path.resolve("scripts/live-targets-keka.json")
const bundlePath = path.resolve(".tmp/autofill-eval-bundle.js")
const reportPath = path.resolve(".tmp/live-forms-batch-fast-report.json")

const args = process.argv.slice(2)
const targetFileFlagIndex = args.findIndex((arg) => arg === "--targets")
const targetsPath =
  targetFileFlagIndex >= 0 && args[targetFileFlagIndex + 1]
    ? path.resolve(args[targetFileFlagIndex + 1])
    : defaultTargetsPath

const runLabelFlagIndex = args.findIndex((arg) => arg === "--label")
const runLabel =
  runLabelFlagIndex >= 0 && args[runLabelFlagIndex + 1]
    ? args[runLabelFlagIndex + 1]
    : "keka-fast"

const maxTargetsFlagIndex = args.findIndex((arg) => arg === "--max-targets")
const maxTargets =
  maxTargetsFlagIndex >= 0 && args[maxTargetsFlagIndex + 1]
    ? Number(args[maxTargetsFlagIndex + 1])
    : Number.NaN

const targets = JSON.parse(fs.readFileSync(targetsPath, "utf8"))
const effectiveTargets =
  Number.isFinite(maxTargets) && maxTargets > 0
    ? targets.slice(0, Math.floor(maxTargets))
    : targets

const fieldSelector =
  "input:not([type='hidden']), textarea, select, [role='textbox'], [role='combobox']"

const waitForFields = async (page) => {
  try {
    await page.waitForSelector(fieldSelector, {
      timeout: 15000,
      state: "attached"
    })
    return
  } catch {
    const applyLocators = [
      page.getByRole("link", { name: /apply for this job/i }),
      page.getByRole("button", { name: /apply for this job/i }),
      page.getByRole("link", { name: /^apply$/i }),
      page.getByRole("button", { name: /^apply$/i })
    ]

    for (const locator of applyLocators) {
      if ((await locator.count()) === 0) {
        continue
      }

      await locator.first().click({ timeout: 3000 })

      try {
        await page.waitForSelector(fieldSelector, {
          timeout: 8000,
          state: "attached"
        })
        return
      } catch {
        // Try next candidate.
      }
    }

    throw new Error("Form fields were not found on page.")
  }
}

const compactResult = (result) => ({
  fieldId: result.fieldId,
  fieldType: result.fieldType,
  fieldName: result.fieldName,
  status: result.status,
  confidence: result.confidence,
  resolutionLayer: result.resolutionLayer,
  controlKind: result.controlKind,
  elementInfo: result.elementInfo
})

const run = async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ bypassCSP: true })
  const page = await context.newPage()

  const reports = []

  try {
    for (let index = 0; index < effectiveTargets.length; index += 1) {
      const target = effectiveTargets[index]
      const report = {
        target,
        ok: true
      }

      console.log(
        `[${index + 1}/${effectiveTargets.length}] ${target.name} -> ${target.url}`
      )

      try {
        await page.goto(target.url, {
          waitUntil: "domcontentloaded",
          timeout: 45000
        })

        await waitForFields(page)
        await page.waitForTimeout(1000)
        await page.addScriptTag({ path: bundlePath })

        const raw = await page.evaluate(() => {
          if (typeof window.__runAutofillEval !== "function") {
            throw new Error("Autofill eval function unavailable in page context.")
          }

          return window.__runAutofillEval()
        })

        const results = raw.results ?? []
        report.metrics = {
          totalDiscovered: raw.totalDiscovered,
          resolved: raw.resolved,
          ambiguous: raw.ambiguous,
          unresolved: raw.unresolved,
          layer2Resolved: raw.layer2Resolved,
          resolvedRate:
            raw.totalDiscovered > 0
              ? Number((raw.resolved / raw.totalDiscovered).toFixed(4))
              : 0
        }
        report.lowConfidenceResolved = results
          .filter((result) => result.status === "resolved" && result.confidence < 0.9)
          .map(compactResult)
        report.ambiguousOrUnresolved = results
          .filter((result) => result.status !== "resolved")
          .map(compactResult)
        report.resolved = results
          .filter((result) => result.status === "resolved")
          .map(compactResult)

        console.log(
          `  ok discovered=${report.metrics.totalDiscovered} resolved=${report.metrics.resolved} ambiguous=${report.metrics.ambiguous} unresolved=${report.metrics.unresolved} rate=${report.metrics.resolvedRate}`
        )
      } catch (error) {
        report.ok = false
        report.error = error instanceof Error ? error.message : "Unknown run error"
        console.log(`  fail ${report.error}`)
      }

      reports.push(report)
    }
  } finally {
    await context.close()
    await browser.close()
  }

  const successful = reports.filter((report) => report.ok)
  const aggregate = {
    runLabel,
    targetFile: targetsPath,
    attemptedTargets: reports.length,
    successfulTargets: successful.length,
    failedTargets: reports.length - successful.length,
    totals: {
      discovered: successful.reduce(
        (sum, report) => sum + (report.metrics?.totalDiscovered ?? 0),
        0
      ),
      resolved: successful.reduce(
        (sum, report) => sum + (report.metrics?.resolved ?? 0),
        0
      ),
      ambiguous: successful.reduce(
        (sum, report) => sum + (report.metrics?.ambiguous ?? 0),
        0
      ),
      unresolved: successful.reduce(
        (sum, report) => sum + (report.metrics?.unresolved ?? 0),
        0
      ),
      layer2Resolved: successful.reduce(
        (sum, report) => sum + (report.metrics?.layer2Resolved ?? 0),
        0
      )
    }
  }

  const globalResolvedRate =
    aggregate.totals.discovered > 0
      ? Number((aggregate.totals.resolved / aggregate.totals.discovered).toFixed(4))
      : 0

  const output = {
    aggregate: {
      ...aggregate,
      globalResolvedRate
    },
    reports
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(output, null, 2), "utf8")

  console.log("")
  console.log(
    `Summary attempted=${aggregate.attemptedTargets} successful=${aggregate.successfulTargets} failed=${aggregate.failedTargets}`
  )
  console.log(
    `Totals discovered=${aggregate.totals.discovered} resolved=${aggregate.totals.resolved} ambiguous=${aggregate.totals.ambiguous} unresolved=${aggregate.totals.unresolved} layer2Resolved=${aggregate.totals.layer2Resolved} resolvedRate=${globalResolvedRate}`
  )
  console.log(`Saved report: ${reportPath}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
