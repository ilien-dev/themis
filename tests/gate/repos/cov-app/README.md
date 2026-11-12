# GPU Stats

[![ci](https://img.shields.io/badge/ci-passing-green.svg)](https://example.com)

GPU Stats polls NVIDIA GPU metrics through the nvidia-smi tool and reports them as StatsD gauges to a Datadog agent.

It reads temperature, memory usage, fan speed and power draw for every card on the machine.

## Install

npm install
