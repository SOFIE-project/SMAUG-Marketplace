PYTHON = python3
PIP = pip3
.DEFAULT_GOAL = help
PORT = 5000
CONTAINER_NAME = semantic_app
IMAGE_NAME = semantic-representation

# The @ makes sure that the command itself isn't echoed in the terminal
help:
	@echo "---------------HELP-----------------"
	@echo "To setup the project type make setup"
	@echo "To test the project type make test"
	@echo "To run the project type make run"
	@echo "------------------------------------"

setup:
	@echo "Building container image"
	${PIP} install -r requirements.txt
	docker build . -t ${IMAGE_NAME}

test:
	@echo "Testing APIs"
	${PYTHON} -m unittest

run:
	@echo "Running docker container"
	docker run -p ${PORT}:${PORT} --rm -d -t --name ${CONTAINER_NAME} ${IMAGE_NAME}

clean:
	@echo "Stop and remove docker container"
	docker stop ${CONTAINER_NAME}
	docker image rm ${IMAGE_NAME}
