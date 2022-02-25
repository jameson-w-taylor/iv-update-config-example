import { Component } from '@angular/core';
import { VaultService, VaultServiceState } from '../vault.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  public state: VaultServiceState;

  constructor(private vaultService: VaultService) {
    this.state = vaultService.state;
  }

  async toggleLock() {
    if (this.state.isLocked) {
      await this.vaultService.restoreSession();
    } else {
      await this.vaultService.lockVault();
    }
  }

  toggleBiometrics() {
    this.vaultService.toggleBiometrics(!this.state.biometricsEnabled);
  }
}
