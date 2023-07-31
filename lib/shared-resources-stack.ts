import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kms from "aws-cdk-lib/aws-kms";
import * as iam from "aws-cdk-lib/aws-iam";
import * as efs from "aws-cdk-lib/aws-efs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface baseProperties extends cdk.StackProps {
  accountName: string;
  envName: string;
  kmsKeyId: kms.IKey;
}

export class sharedResourcesStack extends cdk.Stack {
  private kmsKeyId: kms.IKey;
  constructor(scope: Construct, id: string, props: baseProperties) {
    super(scope, id, props);

    // make the kmskey accessible
    const kmsKeyId = props.kmsKeyId;

    const d_vpc = ec2.Vpc.fromLookup(this, "deployVPC", {
      vpcId: "vpc-0fb37f3d333d536de",
      vpcName: `*${props.env?.account}*`,
    });

    const efsSecurityGroup = new ec2.SecurityGroup(this, "efsSG", {
      vpc: d_vpc,
      allowAllIpv6Outbound: true,
      securityGroupName: `ckan-efs-${props.envName}`,
    });

    const efsVolume = new efs.FileSystem(this, "ckanefsVolume", {
      vpc: d_vpc,
      enableAutomaticBackups: true,
      fileSystemName: `ckan-efs-${props.envName}`,
      kmsKey: kmsKeyId,
      securityGroup: efsSecurityGroup,
    });
  }
}
