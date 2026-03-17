import * as childProcess from "child_process"
import { promisify } from "util"
import * as vscode from "vscode"
import * as which from "which"
import { isAtlasPluginInstalled } from "./installPlugin"

const exec = promisify(childProcess.exec)

const NPM_PACKAGE = "@usergeneratedllc/atlas"

export async function installRojo(folder: string) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Installing Atlas",
      cancellable: false,
    },
    async (progress) => {
      const npmPath = await which("npm").catch(() => null)

      if (!npmPath) {
        const choice = await vscode.window.showErrorMessage(
          "npm is required to install Atlas but was not found on your PATH. " +
            "Install Node.js (which includes npm) and try again.",
          "Open nodejs.org",
        )

        if (choice === "Open nodejs.org") {
          vscode.env.openExternal(
            vscode.Uri.parse("https://nodejs.org/"),
          )
        }

        return
      }

      progress.report({ message: "Installing Atlas via npm..." })

      try {
        await exec(`npm install -g ${NPM_PACKAGE}`)
      } catch (e: any) {
        const stderr: string = e.stderr || ""

        if (
          stderr.includes("401") ||
          stderr.includes("403") ||
          stderr.includes("ENEEDAUTH")
        ) {
          const choice = await vscode.window.showErrorMessage(
            "npm authentication failed. You need to configure GitHub Packages auth first. " +
              "See the Atlas README for setup instructions.",
            "Open Token Setup",
          )

          if (choice === "Open Token Setup") {
            vscode.env.openExternal(
              vscode.Uri.parse(
                "https://github.com/settings/tokens/new?scopes=read:packages&description=read:packages",
              ),
            )
          }

          return
        }

        throw new Error(`npm install failed: ${stderr || e}`)
      }

      await exec("atlas --version")

      if (isAtlasPluginInstalled()) {
        progress.report({ message: "Installing Studio plugin..." })
        try {
          await exec("atlas plugin install")
        } catch (e: any) {
          vscode.window.showWarningMessage(
            `Atlas installed successfully, but the Studio plugin could not be updated: ${e.stderr || e}. ` +
              `You can update it from the Atlas menu or by running "atlas plugin install".`,
          )
        }
      }
    },
  )
}
