import pytest

@pytest.fixture(autouse=True, scope="session")
def PDSComponent():
    import subprocess
    import time
    p1 = subprocess.Popen(['python3', 'PDS/pds.py'])
    time.sleep(5) #Otherwise the server is not ready when tests start
    yield
    p1.terminate()

