import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { VaultService } from '../vault.service';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
})
export class LoginPage {

  constructor(private router: Router, private vaultService: VaultService) {}

  async login() {
    // Simulate login, set fake token in vault
    await this.vaultService.setSession('someTokenValue');
    this.router.navigate(['/home']);
  }
}
