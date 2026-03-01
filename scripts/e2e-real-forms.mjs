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

const extensionPath = path.resolve("build/chrome-mv3-prod")
const userDataDir = path.resolve(".tmp/playwright-user-data")
const reportPath = path.resolve(".tmp/real-form-results.json")

const cleanUserDataDir = () => {
  fs.rmSync(userDataDir, { recursive: true, force: true })
  fs.mkdirSync(userDataDir, { recursive: true })
}

const waitForServiceWorker = async (context) => {
  const existing = context.serviceWorkers()[0]
  if (existing) {
    return existing
  }

  return await context.waitForEvent("serviceworker", {
    timeout: 30000
  })
}

const waitForFormFields = async (page) => {
  const selector = "input:not([type='hidden']), textarea, select, [role='textbox'], [role='combobox']"

  try {
    await page.waitForSelector(selector, {
      state: "attached",
      timeout: 20000
    })
    return
  } catch {
    // Continue and attempt to reveal the form via explicit apply CTA.
  }

  const applyCtaLocators = [
    page.getByRole("link", { name: /apply for this job/i }),
    page.getByRole("button", { name: /apply for this job/i }),
    page.getByRole("link", { name: /^apply$/i }),
    page.getByRole("button", { name: /^apply$/i })
  ]

  for (const locator of applyCtaLocators) {
    if ((await locator.count()) === 0) {
      continue
    }

    await locator.first().click({ timeout: 5000 })

    try {
      await page.waitForSelector(selector, {
        state: "attached",
        timeout: 15000
      })
      return
    } catch {
      // Keep trying fallback locators.
    }
  }

  await page.waitForSelector("body", { state: "attached", timeout: 5000 })
}

const sendFillMessageToActiveTab = async (serviceWorker) => {
  return await serviceWorker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    })

    if (!activeTab?.id) {
      return {
        ok: false,
        error: "No active tab id available for autofill message dispatch."
      }
    }

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        activeTab.id,
        {
          type: "autofill/fill-form",
          debug: false
        },
        (result) => {
          const runtimeError = chrome.runtime.lastError?.message
          if (runtimeError) {
            resolve({ ok: false, error: runtimeError })
            return
          }

          resolve(result ?? { ok: false, error: "No response payload." })
        }
      )
    })

    return response
  })
}

const summarizeResult = (target, response) => {
  if (!response?.ok || !response.summary) {
    return {
      target,
      ok: false,
      error: response?.error ?? "Autofill call did not return summary."
    }
  }

  const { summary } = response

  const layer2Resolved = summary.results.filter(
    (result) => result.resolutionLayer === "layer2" && result.status === "resolved"
  ).length

  const unresolvedSample = summary.results
    .filter((result) => result.status !== "resolved")
    .slice(0, 8)
    .map((result) => ({
      fieldName: result.fieldName,
      status: result.status,
      confidence: result.confidence,
      resolutionLayer: result.resolutionLayer
    }))

  return {
    target,
    ok: true,
    metrics: {
      totalDiscovered: summary.totalDiscovered,
      resolved: summary.resolved,
      ambiguous: summary.ambiguous,
      unresolved: summary.unresolved,
      filled: summary.filled,
      skipped: summary.skipped,
      layer2Resolved
    },
    unresolvedSample
  }
}

const run = async () => {
  cleanUserDataDir()

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const results = []

  try {
    const serviceWorker = await waitForServiceWorker(context)
    const page = await context.newPage()

    for (const target of targets) {
      await page.goto(target.url, {
        waitUntil: "domcontentloaded",
        timeout: 90000
      })

      await page.bringToFront()
      await waitForFormFields(page)

      // Give any lazy-rendered field groups time to mount.
      await page.waitForTimeout(2500)

      const response = await sendFillMessageToActiveTab(serviceWorker)
      const summarized = summarizeResult(target, response)
      results.push(summarized)

      await page.waitForTimeout(1500)
    }
  } finally {
    await context.close()
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8")

  for (const result of results) {
    if (!result.ok) {
      console.log(`❌ ${result.target.name}: ${result.error}`)
      continue
    }

    const { metrics } = result
    console.log(`\n✅ ${result.target.name}`)
    console.log(`URL: ${result.target.url}`)
    console.log(
      `Discovered=${metrics.totalDiscovered}, Resolved=${metrics.resolved}, Filled=${metrics.filled}, Ambiguous=${metrics.ambiguous}, Unresolved=${metrics.unresolved}, Layer2Resolved=${metrics.layer2Resolved}`
    )

    if (result.unresolvedSample.length > 0) {
      console.log("Unresolved/Ambiguous sample:")
      for (const item of result.unresolvedSample) {
        console.log(
          `- ${item.fieldName} [${item.status}] conf=${item.confidence} via=${item.resolutionLayer}`
        )
      }
    }
  }

  console.log(`\nSaved raw results to: ${reportPath}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
