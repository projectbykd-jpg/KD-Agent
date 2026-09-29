from __future__ import annotations

import argparse
import json

from .orchestrator import KDOrchestrator
from .registry import IntegrationRegistry


def main() -> None:
    parser = argparse.ArgumentParser(prog="kd-agent", description="KD Agent control plane")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="Show integration readiness")
    plan = commands.add_parser("plan", help="Create an execution plan without running tools")
    plan.add_argument("objective", help="Task to plan")
    args = parser.parse_args()

    if args.command == "status":
        print(json.dumps(IntegrationRegistry().status(), indent=2))
    else:
        print(json.dumps(KDOrchestrator().plan(args.objective).to_dict(), indent=2))


if __name__ == "__main__":
    main()
