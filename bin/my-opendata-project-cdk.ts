#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ecrKmsStack } from "../lib/ecr-kms-stack";
import { sharedResourcesStack } from "../lib/shared-resources-stack";

const app = new cdk.App();

const envConfigs = {
  accountName: "Rakesh-account",
  accountId: "710878558911",
  region: "ap-southeast-2",
  envName: "dev",
};

const ecrKms = new ecrKmsStack(app, "ecrKmsStack", {
  env: { account: envConfigs.accountId, region: envConfigs.region },
  accountName: envConfigs.accountName,
  envName: envConfigs.envName,
});

const sharedResources = new sharedResourcesStack(app, "sharedResourcesStack", {
  env: { account: envConfigs.accountId, region: envConfigs.region },
  accountName: envConfigs.accountName,
  envName: envConfigs.envName,
  kmsKeyId: ecrKms.kmsKeyId,
});

sharedResources.node.addDependency(ecrKms);
