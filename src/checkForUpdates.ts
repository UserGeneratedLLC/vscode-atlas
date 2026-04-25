import * as childProcess from "child_process"
import { promisify } from "util"
import * as vscode from "vscode"
import which from "which"
import { isAtlasPluginInstalled } from "./installPlugin"

const exec = promisify(childProcess.exec)

const NPM_PACKAGE = "@usergeneratedllc/atlas"
const ONE_DAY = 24 * 60 * 60 * 1000

export async function checkForAtlasUpdates(
  context: vscode.ExtensionContext,
): Promise<void> {
  const lastCheck = context.globalState.get<number>("atlas::lastUpdateCheck")
  if (lastCheck && Date.now() - lastCheck < ONE_DAY) return

  const npmPath = await which("npm").catch(() => null)
  if (!npmPath) return

  let updateAvailable = false
  let currentVersion = ""
  let latestVersion = ""

  try {
    const result = await exec(`npm outdated -g ${NPM_PACKAGE} --json`)
    const output = result.stdout.trim()
    if (output) {
      const data = JSON.parse(output)
      const info = data[NPM_PACKAGE]
      if (info && info.current !== info.latest) {
        updateAvailable = true
        currentVersion = info.current
        latestVersion = info.latest
      }
    }
  } catch (e: any) {
    if (e.stdout) {
      try {
        const data = JSON.parse(e.stdout)
        const info = data[NPM_PACKAGE]
        if (info && info.current !== info.latest) {
          updateAvailable = true
          currentVersion = info.current
          latestVersion = info.latest
        }
      } catch {
        // not parseable, ignore
      }
    }
  }

  context.globalState.update("atlas::lastUpdateCheck", Date.now())

  if (!updateAvailable) return

  const choice = await vscode.window.showInformationMessage(
    `An Atlas update is available: ${currentVersion} → ${latestVersion}`,
    "Update",
    "Dismiss",
  )

  if (choice !== "Update") return

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Updating Atlas...",
    },
    async (progress) => {
      try {
        await exec(`npm install -g ${NPM_PACKAGE}@latest --no-audit --no-fund`)
      } catch (e: any) {
        vscode.window.showErrorMessage(
          `Could not update Atlas: ${e.stderr || e}`,
        )
        return
      }

      if (isAtlasPluginInstalled()) {
        progress.report({ message: "Reinstalling Studio plugin..." })
        try {
          await exec("atlas plugin install")
        } catch {
          vscode.window.showWarningMessage(
            "Atlas updated, but Studio plugin reinstall failed. " +
              'Run "atlas plugin install" manually.',
          )
        }
      }

      vscode.window.showInformationMessage("Atlas updated successfully.")
    },
  )
}
