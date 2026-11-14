import os, pathlib, sys
os.environ["EASYREAD_NO_DOTENV"] = "1"  # set before agent.main is imported: tests never read the repo .env
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
