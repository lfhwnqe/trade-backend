# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `yarn build`    compile typescript to js
* `yarn watch`    watch for changes and compile
* `yarn test`     perform the jest unit tests
* `yarn cdk diff --context envName=<env> --context appName=<app>` compare deployed stack with current state (e.g., `yarn cdk diff --context envName=dev --context appName=trading-app`)
* `yarn cdk synth --context envName=<env> --context appName=<app>` emits the synthesized CloudFormation template (e.g., `yarn cdk synth --context envName=dev --context appName=trading-app`)

### Deploying the Stack

To deploy the stack, you can use the scripts defined in `package.json`:

*   **Development Environment:**
    ```bash
    yarn deploy:dev
    ```
    This command deploys the stack with `envName=dev` and `appName=trading-app` (default).
    You can override `appName` if needed by modifying the script in `package.json` or by running:
    ```bash
    yarn cdk deploy --context envName=dev --context appName=your-custom-app-name
    ```

*   **Production Environment:**
    ```bash
    yarn deploy:prod
    ```
    This command deploys the stack with `envName=prod` and `appName=trading-app` (default).
    Similarly, you can customize `appName`:
    ```bash
    yarn cdk deploy --context envName=prod --context appName=your-custom-app-name
    ```

### Destroying the Stack

To destroy a deployed stack:

*   **Development Environment:**
    ```bash
    yarn destroy:dev
    ```

*   **Production Environment:**
    ```bash
    yarn destroy:prod
    ```

These scripts also use the `envName` and `appName` context parameters defined in `package.json`.

### Context Parameters

The application stack is configured using the following CDK context parameters:

*   `appName`: The name of your application (e.g., `trading-app`, `user-service`). This is used to prefix resource names.
    Default in `cdk.ts` is `trading-app`.
*   `envName`: The deployment environment (e.g., `dev`, `staging`, `prod`). This is used to create environment-specific resources and configurations.
    Default in `cdk.ts` is `dev`.
*   `account`: The AWS account ID.
*   `region`: The AWS region.

These can be passed via the `-c` flag (e.g., `cdk deploy -c appName=myApp -c envName=test`) or set in `cdk.json` or `~/.cdk.json`. The `deploy:*` and `destroy:*` scripts in `package.json` pre-configure `envName` and a default `appName`.
The `account` and `region` are typically determined from your AWS CLI configuration or environment variables (`CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`, `CDK_DEPLOY_ACCOUNT`, `CDK_DEPLOY_REGION`) if not explicitly passed as context.
