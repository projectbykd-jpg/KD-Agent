from __future__ import annotations

import argparse
import json
import os

from .orchestrator import KDOrchestrator
from .registry import IntegrationRegistry
from .web import run_server


def main() -> None:
    parser = argparse.ArgumentParser(prog="kd-agent", description="KD Agent control plane")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="Show integration readiness")
    plan = commands.add_parser("plan", help="Create an execution plan without running tools")
    plan.add_argument("objective", help="Task to plan")
    serve = commands.add_parser("serve", help="Start the local KD Agent web panel")
    serve.add_argument("--host", default=os.getenv("KD_AGENT_HOST", "127.0.0.1"), help="Bind address")
    serve.add_argument("--port", default=int(os.getenv("PORT", "8000")), type=int, help="Port number")
    args = parser.parse_args()

    if args.command == "status":
        print(json.dumps(IntegrationRegistry().status(), indent=2))
    elif args.command == "plan":
        print(json.dumps(KDOrchestrator().plan(args.objective).to_dict(), indent=2))
    else:
        run_server(args.host, args.port)


if __name__ == "__main__":
    main()
