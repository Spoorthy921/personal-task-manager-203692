#!/bin/bash
cd /home/kavia/workspace/code-generation/personal-task-manager-203692/task_manager_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

