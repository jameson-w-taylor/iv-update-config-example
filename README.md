# Identity Vault Test App
This repo contains a very simple sample application showing how you might switch between `Biometric` and  `InMemory` type vaults.
It simulates a login which sets a token in the vault, and then allows you to lock/unlock the vault as well as detecting when a change in biometrics would invalidate the vault.
When this is detected the user is notified and redirected back to the login page.

## Developer Setup
1. Copy your `.npmrc` file containing the product key required to use `@ionic-enterprise/identity-vault`.
2. Run the following commands (can do `ios` or `android` platforms):
    ```bash
    npm install
    ionic cap add android
    ionic cap open android
    ```
3. Follow the [documentation](https://ionic.io/docs/identity-vault/install#capacitor-requirements) for the required native project configuration for Identity Vault
4. Run the application on a native device and use it to simulate various use cases:
    - Try toggling biometric vault on/off to see how you can switch types without losing data in the vault
    - Try locking/unlocking vault before/after changing vault types
    - Try changing biometric settings for your device and see how the app reacts when unlocking the vault afterwards.