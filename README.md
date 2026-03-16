# 👁️‍🗨️ Telepath — Meeting Intelligence

> *AI that understands the emotional and cognitive state of your meeting.*

Telepath observes video and audio to provide real-time metrics on engagement, understanding, and social dynamics.

## Setup

```bash
cd telepath
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
uvicorn server.main:app --port 8001
```
