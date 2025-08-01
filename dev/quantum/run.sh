#!/bin/bash

set -e

sudo chown -R dev: /home/dev

source activate tensorcircuit
jupyter notebook "--ip=*" --port=18382 --no-browser --allow-root


