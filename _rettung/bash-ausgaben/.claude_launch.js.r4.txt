{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "wavebreaker",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173,
      "autoPort": true
    },
    {
      "name": "prototypes",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["--prefix", "prototypes", "run", "dev"],
      "port": 5174
    }
  ]
}
