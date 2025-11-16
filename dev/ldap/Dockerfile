FROM ccrepo.pku.edu.cn/dockerhub/library/rockylinux:8

WORKDIR /ldap
COPY dev/ldap/provider.sh .

RUN sed -e 's|^mirrorlist=|#mirrorlist=|g' \
    -e 's|^#baseurl=http://dl.rockylinux.org/\$contentdir|baseurl=https://mirrors.pku.edu.cn/rocky|g' \
    -i.bak \
    /etc/yum.repos.d/[Rr]ocky*.repo

RUN ulimit -n 10240;./provider.sh docker

VOLUME [ "/var/lib/ldap" ]

CMD ["slapd" ,"-u", "ldap", "-h", "ldap:/// ldapi:///", "-d", "0"]
