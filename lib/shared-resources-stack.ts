import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kms from "aws-cdk-lib/aws-kms";
import * as iam from "aws-cdk-lib/aws-iam";
import * as efs from "aws-cdk-lib/aws-efs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface baseProperties extends cdk.StackProps {
  accountName: string;
  envName: string;
  kmsKey: kms.IKey;
}

export class sharedResourcesStack extends cdk.Stack {
  //   private kmsKeyId: kms.IKey;
  constructor(scope: Construct, id: string, props: baseProperties) {
    super(scope, id, props);

    // make the kmskey accessible
    // const kmsKey = props.kmsKeyId;

    const d_vpc = ec2.Vpc.fromLookup(this, "deployVPC", {
      vpcName: `*${props.env?.account}*`,
    });

    const privateSubnets = d_vpc.publicSubnets; //TODO: change this to private subnets, I don't have private subnets in default vpc

    const privateSubnetIds: string[] = [];

    privateSubnets.forEach((e) => {
      privateSubnetIds.push(e.subnetId);
    });
    // console.log(privateSubnetIds);

    const efsSecurityGroup = new ec2.SecurityGroup(this, "efsSG", {
      vpc: d_vpc,
      allowAllIpv6Outbound: true,
      securityGroupName: `ckan-efs-${props.envName}`,
    });

    const efsVolume = new efs.FileSystem(this, "ckanefsVolume", {
      vpc: d_vpc,
      enableAutomaticBackups: true,
      fileSystemName: `ckan-efs-${props.envName}`,
      kmsKey: props.kmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      securityGroup: efsSecurityGroup,
    });

    const efsCkanAccessPoint = new efs.AccessPoint(this, "ckanAccessPoint", {
      fileSystem: efsVolume,
      path: "/var/lib/ckan",
      createAcl: {
        ownerGid: "1000",
        ownerUid: "1000",
        permissions: "750",
      },
      posixUser: {
        uid: "1000",
        gid: "1000",
      },
    });

    const efsSolrAccesPoint = new efs.AccessPoint(this, "solrAccessPoint", {
      fileSystem: efsVolume,
      path: "/var/solr",
      createAcl: {
        ownerGid: "2000",
        ownerUid: "2000",
        permissions: "750",
      },
      posixUser: {
        uid: "2000",
        gid: "2000",
      },
    });

    const rdsSG = new ec2.SecurityGroup(this, "rdsSG", {
      vpc: d_vpc,
      allowAllOutbound: true,
      securityGroupName: `rdsSG`,
      description: "Security group for the RDS",
    });

    const rdsSubnetGroup = new rds.SubnetGroup(this, "rdsSubnetGroup", {
      description: "SubnetGroup for the ckan RDS",
      vpc: d_vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      vpcSubnets: {
        availabilityZones: [
          "ap-southeast-2a",
          "ap-southeast-2a",
          "ap-southeast-2c",
        ],
        onePerAz: true,
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    const ckanRdsCluster = new rds.DatabaseCluster(this, "rdsCluster", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_03_0,
      }),
      backup: {
        retention: cdk.Duration.days(30),
        preferredWindow: "01:00-02:00",
      },
      copyTagsToSnapshot: true,
      serverlessV2MaxCapacity: 2,
      serverlessV2MinCapacity: 1,
      vpc: d_vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      subnetGroup: rdsSubnetGroup,
      writer: rds.ClusterInstance.serverlessV2("writer", {
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        enablePerformanceInsights: true,
        instanceIdentifier: "ckan-db",
        publiclyAccessible: false,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2("reader1", { scaleWithWriter: true }),
      ],
    });
    // Redis cluster
    const ckanRedisSG = new ec2.SecurityGroup(this, "redisSG", {
      vpc: d_vpc,
      allowAllOutbound: true,
      description: "Security Group for the Redis cluster",
    });

    const ckanRedisPG = new elasticache.CfnParameterGroup(this, "redisPG", {
      cacheParameterGroupFamily: "redis7",
      description: "ckan redis Parameter group",
    });

    const ckanRedisSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "redisSubnetGroup",
      {
        description: "ckan redis subnet group",
        subnetIds: privateSubnetIds,
        cacheSubnetGroupName: "ckan-redis-sg",
      }
    );

    const ckanRedisCluster = new elasticache.CfnReplicationGroup(
      this,
      "redisreplicationgroup",
      {
        replicationGroupDescription: "ckan-redis-cluster",
        atRestEncryptionEnabled: true,
        automaticFailoverEnabled: true,
        cacheNodeType: "cache.t3.small",
        multiAzEnabled: true,
        cacheParameterGroupName: ckanRedisPG.cacheParameterGroupFamily,
        cacheSubnetGroupName: ckanRedisSubnetGroup.ref,
        engine: "Redis",
        engineVersion: "7",
        kmsKeyId: props.kmsKey.keyId.toString(),
        replicasPerNodeGroup: 1,
        transitEncryptionEnabled: true,
        securityGroupIds: [ckanRedisSG.securityGroupId],
        port: 6379,
        snapshotRetentionLimit: 30,
        preferredMaintenanceWindow: "sat:16:00-sat:16:30",
      }
    );
  }
}
