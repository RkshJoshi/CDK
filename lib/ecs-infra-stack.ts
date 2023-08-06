import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { CfnInput } from "aws-cdk-lib/aws-medialive";

interface baseProperties extends cdk.StackProps {
  accountName: String;
  envName: String;
}

export class ecsInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: baseProperties) {
    super(scope, id, props);

    const d_vpc = ec2.Vpc.fromLookup(this, "deployVPC", {
      vpcName: `*${props.env?.account}*`,
    });

    const ckanCluster = new ecs.Cluster(this, "ecsCluster", {
      vpc: d_vpc,
      containerInsights: false,
      enableFargateCapacityProviders: true,
    });

    const ckanTaskDef = new ecs.FargateTaskDefinition(this, "ckanTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    ckanTaskDef.addContainer("ckan-container", {
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(
          this,
          "ckanrepo",
          cdk.Fn.importValue("ckanRepoName")
        )
      ),
      environment: { CKAN_SITE_URL: "https://ckan:5000" },
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:5000 || exit 1"],
        interval: cdk.Duration.seconds(30),
        retries: 3,
        timeout: cdk.Duration.seconds(20),
      },
    });
  }
}
