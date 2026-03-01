import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright"

const targets = [
  {
    name: "Anthropic",
    url: "https://job-boards.greenhouse.io/anthropic/jobs/5074975008"
  },
  {
    name: "Figma",
    url: "https://job-boards.greenhouse.io/figma/jobs/5426468004?gh_jid=5426468004"
  }
]

const bundlePath = path.resolve(".tmp/autofill-eval-bundle.js")
const reportPath = path.resolve(".tmp/real-form-results.json")

const waitForFields = async (page) => {
  const fieldSelector = "input:not([type='hidden']), textarea, select, [role='textbox'], [role='combobox']"

  try {
    await page.waitForSelector(fieldSelector, {
      timeout: 30000,
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

      await locator.first().click({ timeout: 5000 })

      try {
        await page.waitForSelector(fieldSelector, {
          timeout: 15000,
          state: "attached"
        })
        return
      } catch {
        // Try next candidate.
      }
    }
  }
}

const summarize = (rawResult, target) => {
  const results = rawResult.results ?? []
  const unresolvedSample = results
    .filter((result) => result.status !== "resolved")
    .slice(0, 12)
    .map((result) => ({
      fieldName: result.fieldName,
      status: result.status,
      confidence: result.confidence,
      resolutionLayer: result.resolutionLayer
    }))

  const lowConfidenceResolved = results
    .filter((result) => result.status === "resolved" && result.confidence < 0.9)
    .slice(0, 8)
    .map((result) => ({
      fieldName: result.fieldName,
      confidence: result.confidence,
      resolutionLayer: result.resolutionLayer
    }))

  return {
    target,
    metrics: {
      totalDiscovered: rawResult.totalDiscovered,
      resolved: rawResult.resolved,
      ambiguous: rawResult.ambiguous,
      unresolved: rawResult.unresolved,
      layer2Resolved: rawResult.layer2Resolved
    },
    results,
    unresolvedSample,
    lowConfidenceResolved
  }
}

const run = async () => {
  const browser = await chromium.launch({
    headless: true
  })

  const context = await browser.newContext()
  const page = await context.newPage()
  const reports = []

  try {
    for (const target of targets) {
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 120000
      })

      await waitForFields(page)
      await page.waitForTimeout(2000)
      await page.addScriptTag({ path: bundlePath })

      const rawResult = await page.evaluate(() => {
        if (typeof window.__runAutofillEval !== "function") {
          throw new Error("Autofill eval function was not initialized in page context.")
        }

        return window.__runAutofillEval()
      })

      reports.push(summarize(rawResult, target))
    }
  } finally {
    await context.close()
    await browser.close()
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2), "utf8")

  for (const report of reports) {
    console.log(`\n=== ${report.target.name} ===`)
    console.log(report.target.url)
    console.log(
      `Discovered=${report.metrics.totalDiscovered}, Resolved=${report.metrics.resolved}, Ambiguous=${report.metrics.ambiguous}, Unresolved=${report.metrics.unresolved}, Layer2Resolved=${report.metrics.layer2Resolved}`
    )

    if (report.unresolvedSample.length > 0) {
      console.log("Sample unresolved/ambiguous fields:")
      for (const item of report.unresolvedSample) {
        console.log(
          `- ${item.fieldName} [${item.status}] conf=${item.confidence} via=${item.resolutionLayer}`
        )
      }
    }

    if (report.lowConfidenceResolved.length > 0) {
      console.log("Resolved with confidence < 0.9:")
      for (const item of report.lowConfidenceResolved) {
        console.log(
          `- ${item.fieldName} conf=${item.confidence} via=${item.resolutionLayer}`
        )
      }
    }
  }

  console.log(`\nSaved report: ${reportPath}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
