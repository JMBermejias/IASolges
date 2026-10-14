#!/usr/bin/env python3
"""Punto de entrada de IASolges instalado en /opt/iasolges."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from iasolges.launcher import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())