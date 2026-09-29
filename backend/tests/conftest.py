"""Test configuration and fixtures for ArthSahayak backend tests."""

import os
import pytest


@pytest.fixture(autouse=True)
def default_allow_stub_providers(monkeypatch):
    """Enable stub providers by default for offline integration and UI flow tests.

    Tests that specifically verify production missing-credential failures can override
    this by setting ALLOW_STUB_PROVIDERS="false" or deleting ALLOW_STUB_PROVIDERS.
    """
    monkeypatch.setenv("ALLOW_STUB_PROVIDERS", "true")
