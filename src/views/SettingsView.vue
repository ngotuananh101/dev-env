<template>
  <div class="h-full flex flex-col p-6 animate-fade-in overflow-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-white flex items-center space-x-2">
        <Settings class="w-6 h-6 text-blue-400" />
        <span>Settings</span>
      </h1>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <!-- Site Configuration -->
      <Card class="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle class="text-lg text-white">Site Configuration</CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Default PHP Version -->
          <div class="space-y-2">
            <Label>Default PHP Version</Label>
            <Select v-model="settings.default_php_version">
              <SelectTrigger class="bg-background border-gray-600 text-white">
                <SelectValue placeholder="Select PHP Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in phpVersions"
                  :key="p.installedVersion"
                  :value="p.installedVersion"
                >
                  PHP {{ p.installedVersion }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p
              v-if="phpVersions.length === 0"
              class="text-xs text-yellow-500 mt-1"
            >
              No PHP versions installed. Please install PHP from the dashboard.
            </p>
          </div>

          <!-- Site Template -->
          <div class="space-y-2">
            <Label>Default Site Template</Label>
            <Input
              v-model="settings.site_template"
              placeholder="[site].local"
            />
            <p class="text-xs text-muted-foreground">
              Pattern for default local domain. Use [site] as placeholder for
              the site name.
            </p>
          </div>

          <!-- Auto Create -->
          <div
            class="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors"
          >
            <div class="space-y-1">
              <span class="block text-sm font-medium text-white"
                >Auto-create Sites</span
              >
              <span class="block text-xs text-gray-500"
                >Automatically create site base on root folder. Only create as
                PHP site.</span
              >
            </div>
            <Switch
              :defaultValue="settings.site_auto_create"
              @update:modelValue="settings.site_auto_create = $event"
            />
          </div>
        </CardContent>
        <CardFooter class="border-t border-gray-700/50 pt-4">
          <Button
            variant="success"
            :disabled="isSaving"
            @click="saveAllSettings"
          >
            <Save class="w-4 h-4" />
            {{ isSaving ? "Saving..." : "Save Settings" }}
          </Button>
        </CardFooter>
      </Card>

      <!-- Application Behavior -->
      <Card class="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle class="text-lg text-white">Application Behavior</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Close to Tray -->
          <div
            class="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors"
          >
            <div class="space-y-1">
              <span class="block text-sm font-medium text-white"
                >Close to System Tray</span
              >
              <span class="block text-xs text-gray-500"
                >When clicking the X button, minimize to system tray instead of
                quitting the app.</span
              >
            </div>
            <Switch
              :defaultValue="settings.close_to_tray"
              @update:modelValue="
                (val) => {
                  settings.close_to_tray = val;
                  saveCloseToTray(val);
                }
              "
            />
          </div>

          <!-- Start with Windows -->
          <div
            class="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors"
          >
            <div class="space-y-1">
              <span class="block text-sm font-medium text-white"
                >Start with Windows</span
              >
              <span class="block text-xs text-gray-500"
                >Automatically start the application when you log in to
                Windows.</span
              >
            </div>
            <Switch
              :defaultValue="settings.start_with_windows"
              @update:modelValue="
                (val) => {
                  settings.start_with_windows = val;
                  saveStartWithWindows(val);
                }
              "
            />
          </div>
          <p class="text-xs text-gray-500">
            Note: The minimize button (-) will always minimize to system tray.
            Use "Quit App" from sidebar or tray menu to fully exit.
          </p>
        </CardContent>
      </Card>

      <!-- System Information -->
      <Card class="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle class="text-lg text-white">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-gray-400 mb-4">
            View detailed information about your system and application.
          </p>
          <Button
            variant="default"
            :disabled="loadingSystemInfo"
            @click="openSystemInfo"
          >
            <Monitor class="w-4 h-4" />
            {{ loadingSystemInfo ? "Loading..." : "View System Info" }}
          </Button>
        </CardContent>
      </Card>

      <!-- SSL Certificate -->
      <Card class="bg-gray-800/50 border-gray-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle class="text-lg text-white">SSL Certificate</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-gray-400 mb-4">
            Manage SSL certificates for local HTTPS development.
          </p>

          <!-- CA Status -->
          <div
            class="mb-4 p-3 rounded-lg border"
            :class="
              sslStatus.caInstalledInSystem
                ? 'bg-green-900/30 border-green-700/50'
                : 'bg-yellow-900/30 border-yellow-700/50'
            "
          >
            <div class="flex items-center space-x-2">
              <div
                class="w-2 h-2 rounded-full"
                :class="
                  sslStatus.caInstalledInSystem
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                "
              ></div>
              <span
                class="text-sm"
                :class="
                  sslStatus.caInstalledInSystem
                    ? 'text-green-400'
                    : 'text-yellow-400'
                "
              >
                {{
                  sslStatus.caInstalledInSystem
                    ? "CA is installed in system trust store"
                    : "CA is not installed - browsers will show warnings"
                }}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <Button
              v-if="!sslStatus.caInstalledInSystem"
              variant="success"
              :disabled="installingCA"
              @click="installCA"
            >
              <ShieldCheck class="w-4 h-4" />
              {{ installingCA ? "Installing..." : "Install CA to System" }}
            </Button>

            <Button
              v-else
              variant="destructive"
              :disabled="uninstallingCA"
              @click="uninstallCA"
            >
              <ShieldOff class="w-4 h-4" />
              {{
                uninstallingCA ? "Uninstalling..." : "Uninstall CA from System"
              }}
            </Button>

            <Button variant="secondary" @click="refreshSSLStatus">
              <RefreshCw
                class="w-4 h-4"
                :class="{ 'animate-spin': loadingSSL }"
              />
              Refresh Status
            </Button>
          </div>

          <p
            v-if="sslStatus.caCertPath"
            class="text-xs text-gray-500 mt-3 break-all font-mono"
          >
            CA Path: {{ sslStatus.caCertPath }}
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- System Info Modal -->
    <Dialog v-model:open="showSystemInfoModal">
      <DialogContent
        class="max-w-[800px] bg-[#252526] border-gray-700 text-gray-200"
      >
        <DialogHeader>
          <DialogTitle class="flex items-center space-x-2">
            <Monitor class="w-5 h-5 text-blue-400" />
            <span>System Information</span>
          </DialogTitle>
        </DialogHeader>

        <div class="h-[60vh] flex flex-col">
          <textarea
            v-model="systemInfoContent"
            readonly
            class="w-full h-full bg-gray-900 p-4 text-gray-300 font-mono text-sm resize-none focus:outline-none custom-scrollbar rounded"
          ></textarea>
        </div>

        <DialogFooter>
          <Button variant="secondary" @click="copySystemInfo">
            <Copy class="w-4 h-4" />
            Copy
          </Button>
          <Button @click="showSystemInfoModal = false"> Close </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useDatabaseStore } from "../stores/database";
import {
  Copy,
  Monitor,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  ShieldOff,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { copyToClipboard } from "../utils/helpers";

const dbStore = useDatabaseStore();

const settings = ref({
  site_template: "",
  site_auto_create: false,
  default_php_version: "",
  close_to_tray: true,
  start_with_windows: false,
});

const phpVersions = ref([]);

// System Info
const showSystemInfoModal = ref(false);
const loadingSystemInfo = ref(false);
const systemInfoContent = ref("");
const isSaving = ref(false);

// SSL
const sslStatus = ref({
  initialized: false,
  caExists: false,
  caInstalledInSystem: false,
  sslDir: null,
  caCertPath: null,
});
const installingCA = ref(false);
const uninstallingCA = ref(false);
const loadingSSL = ref(false);

const refreshSSLStatus = async () => {
  loadingSSL.value = true;
  try {
    sslStatus.value = await window.sysapi.ssl.getStatus();
  } catch (error) {
    console.error("Failed to get SSL status:", error);
  } finally {
    loadingSSL.value = false;
  }
};

const installCA = async () => {
  installingCA.value = true;
  try {
    const result = await window.sysapi.ssl.installCA();
    if (result.success) {
      if (result.alreadyInstalled) {
        toast.info("CA is already installed in system");
      } else {
        toast.success("CA installed successfully!");
      }
      await refreshSSLStatus();
    } else {
      toast.error(
        `Failed to install CA: ${result.error || "Cancelled by user"}`,
      );
    }
  } catch (error) {
    console.error("Failed to install CA:", error);
    toast.error("Failed to install CA");
  } finally {
    installingCA.value = false;
  }
};

const uninstallCA = async () => {
  uninstallingCA.value = true;
  try {
    const result = await window.sysapi.ssl.uninstallCA();
    if (result.success) {
      if (result.notInstalled) {
        toast.info("CA is not installed in system");
      } else {
        toast.success("CA uninstalled successfully!");
      }
      await refreshSSLStatus();
    } else {
      toast.error(
        `Failed to uninstall CA: ${result.error || "Cancelled by user"}`,
      );
    }
  } catch (error) {
    console.error("Failed to uninstall CA:", error);
    toast.error("Failed to uninstall CA");
  } finally {
    uninstallingCA.value = false;
  }
};

const openSystemInfo = async () => {
  loadingSystemInfo.value = true;
  try {
    const result = await window.sysapi.getSystemInfo();
    if (result.success) {
      systemInfoContent.value = result.info;
      showSystemInfoModal.value = true;
    } else {
      toast.error(`Failed to get system info: ${result.error}`);
    }
  } catch (error) {
    console.error("Failed to get system info:", error);
    toast.error("Failed to get system info");
  } finally {
    loadingSystemInfo.value = false;
  }
};

const copySystemInfo = async () => {
  await copyToClipboard(
    systemInfoContent.value,
    "Copied to clipboard",
    "Failed to copy",
  );
};

// Auto-save close_to_tray setting when toggled
const saveCloseToTray = async (value) => {
  try {
    await dbStore.saveSetting("close_to_tray", value);
    toast.success(
      value
        ? "App will minimize to tray when closed"
        : "App will quit when closed",
    );
  } catch (error) {
    console.error("Failed to save close_to_tray setting:", error);
    toast.error("Failed to save setting");
  }
};

// Auto-save start_with_windows setting when toggled
const saveStartWithWindows = async (value) => {
  try {
    const result = await window.sysapi.system.toggleStartup(value);
    if (result.success) {
      toast.success(
        value
          ? "App will start with Windows"
          : "App will not start with Windows",
      );
    } else {
      // Revert on failure
      settings.value.start_with_windows = !value;
      toast.error(`Failed to update startup setting: ${result.error}`);
    }
  } catch (error) {
    console.error("Failed to save start_with_windows setting:", error);
    // Revert on failure
    settings.value.start_with_windows = !value;
    toast.error("Failed to save setting");
  }
};

onMounted(async () => {
  await dbStore.loadSettings();
  settings.value.site_template =
    dbStore.settings.site_template || "[site].local";
  settings.value.default_php_version =
    dbStore.settings.default_php_version || "";
  // Convert string 'true'/'false' to boolean for checkbox
  settings.value.site_auto_create =
    dbStore.settings.site_auto_create === "true" ||
    dbStore.settings.site_auto_create === true;
  // Close to tray setting (default: true)
  settings.value.close_to_tray =
    dbStore.settings.close_to_tray !== "false" &&
    dbStore.settings.close_to_tray !== false;

  // Load startup status
  try {
    const startupResult = await window.sysapi.system.getStartupStatus();
    if (startupResult.success) {
      settings.value.start_with_windows = startupResult.enabled;
    }
  } catch (error) {
    console.error("Failed to load startup status:", error);
  }

  // Load installed PHP versions
  try {
    const result = await window.sysapi.apps.getList();
    if (result.apps) {
      phpVersions.value = result.apps.filter(
        (app) => app.id.startsWith("php") && app.status === "installed",
      );
      // Sort by version desc
      phpVersions.value.sort((a, b) =>
        b.installedVersion.localeCompare(a.installedVersion, undefined, {
          numeric: true,
        }),
      );
    }
  } catch (error) {
    console.error("Failed to load apps:", error);
  }

  // Load SSL status
  await refreshSSLStatus();
});

const saveAllSettings = async () => {
  isSaving.value = true;
  try {
    // Special handling for site_template - update all existing sites
    const oldTemplate = dbStore.settings.site_template;
    if (oldTemplate && oldTemplate !== settings.value.site_template) {
      toast.info("Updating sites with new template...");
      const result = await window.sysapi.sites.updateTemplate(
        oldTemplate,
        settings.value.site_template,
      );

      if (result.error) {
        toast.error(`Failed to update sites: ${result.error}`);
      }

      if (result.updated && result.updated.length > 0) {
        toast.success(
          `Updated ${result.updated.length} site(s) to new template`,
        );
      }

      if (result.failed && result.failed.length > 0) {
        const failedNames = result.failed.map((f) => f.site).join(", ");
        toast.warning(
          `${result.failed.length} site(s) could not be updated: ${failedNames}`,
        );
        console.warn("Failed sites:", result.failed);
      }
    }

    // Local update for default_php_version with side effects (phpMyAdmin config)
    if (
      settings.value.default_php_version !==
      dbStore.settings.default_php_version
    ) {
      const result = await window.sysapi.apps.updateDefaultPhp(
        settings.value.default_php_version,
      );
      if (result.error) throw new Error(result.error);
    }

    await dbStore.saveSetting("site_template", settings.value.site_template);
    await dbStore.saveSetting(
      "site_auto_create",
      settings.value.site_auto_create,
    );

    // Reload settings to ensure store is in sync
    await dbStore.loadSettings();

    toast.success("Settings saved successfully!");
  } catch (error) {
    console.error("Save settings error:", error);
    toast.error("Failed to save settings");
  } finally {
    isSaving.value = false;
  }
};
</script>
