FROM  ubuntu:18.04

RUN apt-get update && apt-get install -y \
    python3.7 \
    python3-pip

LABEL Author=filippo.vimini@aalto.com

COPY ./ /var/semantic-representation/

RUN pip3 install -r /var/semantic-representation/requirements.txt

RUN cd /var/semantic-representation/

WORKDIR /project

EXPOSE 5000

ENTRYPOINT [ "sh","/var/semantic-representation/boot.sh" ]