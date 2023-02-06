#!/usr/bin/env python3

import aws_cdk as cdk

from cdk_demo.cdk_demo_stack import CdkDemoStack


app = cdk.App()
CdkDemoStack(app, "cdk-demo")

app.synth()
