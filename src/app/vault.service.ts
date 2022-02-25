import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ToastController } from '@ionic/angular';
import {
  Vault,
  DeviceSecurityType,
  VaultType,
  BrowserVault,
  IdentityVaultConfig,
  VaultErrorCodes,
} from '@ionic-enterprise/identity-vault';
import { Platform } from '@ionic/angular';

const config: IdentityVaultConfig = {
  key: 'accenture.iv.example',
  type: VaultType.DeviceSecurity,
  deviceSecurityType: DeviceSecurityType.Biometrics,
  lockAfterBackgrounded: 2000,
  shouldClearVaultAfterTooManyFailedAttempts: true,
  customPasscodeInvalidUnlockAttempts: 2,
  unlockVaultOnLoad: false,
};
const key = 'sessionData';

export interface VaultServiceState {
  session?: string;
  isLocked: boolean;
  isEmpty: boolean;
  biometricsEnabled: boolean;
  vaultType: VaultType;
  deviceSecurity: DeviceSecurityType;
}

@Injectable({ providedIn: 'root' })
export class VaultService {
  public state: VaultServiceState = {
    session: undefined,
    isLocked: false,
    isEmpty: true,
    biometricsEnabled: true,
    vaultType: config.type,
    deviceSecurity: config.deviceSecurityType
  };

  vault: Vault | BrowserVault;

  constructor(private ngZone: NgZone, private platform: Platform, private router: Router, private toastController: ToastController) {
    this.vault = Capacitor.getPlatform() === 'web' ? new BrowserVault(config) : new Vault(config);
  }

  async init() {
    this.state.vaultType = this.vault.config.type;
    this.state.deviceSecurity = this.vault.config.deviceSecurityType;
    this.state.isEmpty = await this.vault.isEmpty();

    this.vault.onLock(() => {
      this.ngZone.run(async () => {
        this.state.isLocked = true;
        this.state.session = undefined;
        this.state.isEmpty = await this.vault.isEmpty();
      });
    });
    
    this.vault.onUnlock(() => {
      this.ngZone.run(() => {
        this.state.isLocked = false;
      });
    });

    this.vault.onError(async (error) => {
      switch (error.code) {
        case VaultErrorCodes.InvalidatedCredential: {
          await this.clearVault();
          await this.handleInvalidatedCredentials();
        }
        case VaultErrorCodes.AndroidUnexpectedKeystoreError: {
          // This error can be for other reasons, so check for message that matches what you've observed when testing
          const biometricsAltered = error.message.match(/key permanently invalidated/i);
          if (biometricsAltered) {
            await this.clearVault();
            await this.handleInvalidatedCredentials();
          }
        }
      }
    });

    this.vault.onConfigChanged((config) => {
      this.ngZone.run(() => {
        this.state.vaultType = config.type;
        this.state.deviceSecurity = config.deviceSecurityType;
      });
    });
  }

  async lockVault() {
    await this.vault.lock();
    // TODO: InMemory Vault currently has a bug where it does not emit the onLock event (notified IV team)
    if (this.vault.config.type === VaultType.InMemory) {
      this.handleInMemoryLock();
    }
  }

  async setSession(value: string): Promise<void> {
    this.state.session = value;
    await this.vault.setValue(key, value);
    this.state.isEmpty = await this.vault.isEmpty();
  }

  async restoreSession() {
    try {
      // NOTE: This will unlock the vault (if locked) to get the value
      //       If biometrics were changed since last unlock event this is when the vault will error (see line 72-87)
      //       If Vault is InMemory and was previously locked, the vault was cleared so there is no longer any data to restore
      const value = await this.vault.getValue(key);
      this.state.session = value === null ? undefined : value;
    } catch (e) {
      this.state.session = '';
    }
  }

  async toggleBiometrics(enable: boolean) {
    this.state.biometricsEnabled = enable;

    if (enable) {
      // If InMemory vault is locked when changing types, user will not be prompted
      await this.vault.updateConfig({
        ...this.vault.config,
        type: VaultType.DeviceSecurity,
        deviceSecurityType: DeviceSecurityType.Biometrics
      });

      // TODO: InMemory Vault currently has a bug where it does not emit the onLock event (notified IV team)
      //       This removes the workaround when it's not needed
      await this.handleInMemoryLockOnAppResume(false);
    } else {
      // If Biometric vault is locked when changing types, user will be prompted to unlock
      await this.vault.updateConfig({
        ...this.vault.config,
        type: VaultType.InMemory,
        deviceSecurityType: DeviceSecurityType.None
      });

      // TODO: InMemory Vault currently has a bug where it does not emit the onLock event (notified IV team)
      //       This adds a workaround when needed
      await this.handleInMemoryLockOnAppResume(true);
    }
  }

  async clearVault() {
    await this.vault.clear();
    this.state.session = undefined;
    this.state.isEmpty = await this.vault.isEmpty();
  }

  private async handleInvalidatedCredentials() {
    const toast = await this.toastController.create({
      header: 'Altered Biometrics',
      message: 'Please login again',
      icon: 'finger-print',
      position: 'top',
      color: 'danger',
      duration: 3000
    });
    await toast.present();
    this.router.navigate(['/login']);
  }

  // TODO: InMemory Vault currently has a bug where it does not emit the onLock event (notified IV team)
  //       Locking an InMemory Vault is the same as clearing it, so afterwards the state is actually unlocked & empty
  private async handleInMemoryLock() {
    this.state.isLocked = false;
    this.state.session = undefined;
    this.state.isEmpty = await this.vault.isEmpty();
  }

  // TODO: InMemory Vault currently has a bug where it does not emit the onLock event (notified IV team)
  //       So if the vault is locked due to the lockAfterBackgrounded setting, the vault state shown in the app would not get updated
  //       This should be fixed once the IV team has a chance to address this bug, and this "workaround" will not be needed
  private async handleInMemoryLockOnAppResume(addListener: boolean) {
    if (addListener) {
      await App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          // NOTE: When app resumes while vault is InMemory, check to see if it locked and was cleared
          //       This is when you could redirect to login, but I left it this way so you can actually see vault status
          this.ngZone.run(async () => {
            this.state.isEmpty = await this.vault.isEmpty();
            this.state.isLocked = await this.vault.isLocked();
            if (!this.state.isLocked) {
              await this.restoreSession();
            }
          });
        }
      });
    } else {
      await App.removeAllListeners();
    }
  }
}