FROM ccrepo.pku.edu.cn/dockerhub/library/alpine:3.20

ENV TZ Asia/Shanghai

RUN apk add --no-cache openssh sudo

RUN echo 'root:root' | chpasswd

COPY ./entry.sh /entry.sh

RUN ssh-keygen -A ; mkdir /root/.ssh

RUN echo "PermitRootLogin yes" >> /etc/ssh/sshd_config; sed -i -e '$aPubkeyAcceptedKeyTypes=+ssh-rsa\n' /etc/ssh/sshd_config

RUN adduser -D test;echo "test:test" | chpasswd ; mkdir /home/test/.ssh/ ; chown test.test home/test/.ssh/

CMD ["sh", "/entry.sh"]
