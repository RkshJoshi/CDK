import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as kms from "aws-cdk-lib/aws-kms";
import * as iam from "aws-cdk-lib/aws-iam";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface baseProperties extends cdk.StackProps {
  accountName: string;
  envName: string;
}

export class ecrKmsStack extends cdk.Stack {
  public readonly kmsKey: kms.IKey;
  public service_name: string[] = ["ckan", "solr", "datapusher"];
  constructor(scope: Construct, id: string, props: baseProperties) {
    super(scope, id, props);

    const kmsKeyPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ["kms:*"],
          principals: [new iam.AccountRootPrincipal()],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          actions: [
            "kms:Encrypt",
            "kms:Decrypt",
            "kms:ReEncrypt*",
            "kms:GenerateDataKey*",
            "kms:DescribeKey",
          ],
          principals: [
            new iam.ServicePrincipal("rds.amazonaws.com"),
            new iam.ServicePrincipal("replication.ecr.amazonaws.com"),
            new iam.ServicePrincipal("pullthroughcache.ecr.amazonaws.com"),
            new iam.ServicePrincipal("elasticfilesystem.amazonaws.com"),
          ],
          resources: ["*"],
          conditions: {
            StringEquals: {
              "kms:CallerAccount": `${props.env?.account}`,
            },
          },
        }),
      ],
    });

    this.kmsKey = new kms.Key(this, "ckankey", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      alias: "alias/ckankey",
      policy: kmsKeyPolicy,
    });

    this.service_name.forEach((service) => {
      const repo = new ecr.Repository(this, `${service}-repo`, {
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
        repositoryName: `${service}-repo-${props.envName}`,
        encryptionKey: this.kmsKey,
        autoDeleteImages: true,
        imageScanOnPush: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      repo.addLifecycleRule({
        description: "Keep only 10 images",
        maxImageCount: 10,
        rulePriority: 1,
        tagStatus: ecr.TagStatus.ANY,
      });
      new cdk.CfnOutput(this, `repoURI-${service}`, {
        value: repo.repositoryName,
        description: `Repo URI of ${service}`,
        exportName: `${service}RepoName`,
      });
    });
  }
}
