#!/bin/sh
set -ex

### Start Configuration Part

# LDAP configurations
dn="pku"
ou="hpc"
# LDAP admin password
adminPasswd="admin"

## SSL Certificates configurations
Country="CN"
Province="Beijing"
Locality="Beijing"
OrganName="PKU"
OrganUnit="HPC pku"
CommonName="hpc.pku.edu.cn"
EmailAddr="xxx@hpc.pku.edu.cn"
Phrase="wrongpassword"

### End Configuration Part

#
#   in this script,OoenLDAP admin password is mayinping,you can change it.
#   Add a user named cent, user'd password is also mayinping.
#
# * Create a password that can be inserted into the ldif files.
#   echo `slappasswd -s secret`
#

DN="o=$dn"
OU="ou=$ou"

###########################################################
# Install LDAP-server
#
# This part should only be executed on the LDAP-Server
###########################################################

# Communication with the LDAP-server needs to be done with domain name, and not
# the ip. This ensures the dns-name is configured.
#cat >> /etc/hosts << EOF
#162.105.133.248 slapd02.pku.edu.cn slapd02 ldap-2
#EOF

##############################################################################################################
##############################################################################################################
# before install openldap, you should turn off selinux

# vi /etc/selinux/config
# SELINUX=disabled

##############################################################################################################
##############################################################################################################

##############################################################################################################
##### install
#[1] Install OpenLDAP Server.
echo "Step 1: Install OpenLDAP Server."

# if is in docker

if [ "$1" = 'docker' ]; then
  IN_DOCKER=1
fi

# remove openldap before install
if ! [[ -n IN_DOCKER ]]; then
  exit 1
  yum -y remove openldap-servers openldap-clients nss-pam-ldapd
  rm -rf /etc/openldap
  rm -rf /var/lib/ldap/*
fi

yum install -y epel-release

sed -e 's!^metalink=!#metalink=!g' \
    -e 's!^#baseurl=!baseurl=!g' \
    -e 's!https\?://download\.fedoraproject\.org/pub/epel!https://mirrors.ustc.edu.cn/epel!g' \
    -e 's!https\?://download\.example/pub/epel!https://mirrors.ustc.edu.cn/epel!g' \
    -i /etc/yum.repos.d/epel{,-testing}.repo

dnf config-manager --set-enabled powertools

yum install -y openldap-servers openldap-clients nss-pam-ldapd

if [[ -n $IN_DOCKER ]]; then

  yum install -y openssl

  echo "Starting slapd directly"
  slapd -u ldap -h "ldap:/// ldapi:///"
else
  echo "Starting slapd using systemctl"
  systemctl start slapd
  systemctl enable slapd
fi

# Create backend database.
cp /usr/share/openldap-servers/DB_CONFIG.example /var/lib/ldap/DB_CONFIG
chown -R ldap. /var/lib/ldap/DB_CONFIG

#[2] Set OpenLDAP admin password.
#generate encrypted password
echo "Step 2: Set OpenLDAP admin password."
pw=$(slappasswd -s $adminPasswd)

cat >>/etc/openldap/chrootpw.ldif <<EOF
dn: olcDatabase={0}config,cn=config
changetype: modify
add: olcRootPW
olcRootPW: $pw
EOF

ldapadd -Y EXTERNAL -H ldapi:/// -f /etc/openldap/chrootpw.ldif

#[3] Import basic Schemas.
echo "Step 3:Import basic Schemas."
ldapadd -Y EXTERNAL -H ldapi:/// -f /etc/openldap/schema/cosine.ldif
ldapadd -Y EXTERNAL -H ldapi:/// -f /etc/openldap/schema/nis.ldif
ldapadd -Y EXTERNAL -H ldapi:/// -f /etc/openldap/schema/inetorgperson.ldif

#[4]Set your domain name on LDAP DB.
echo "Step 4:Set your domain name on LDAP DB."

cat >>/etc/openldap/chdomain.ldif <<EOF
# replace to your own domain name for "dc=***,dc=***" section
# specify the password generated above for "olcRootPW" section
dn: olcDatabase={1}monitor,cn=config
changetype: modify
replace: olcAccess
olcAccess: {0}to * by dn.base="gidNumber=0+uidNumber=0,cn=peercred,cn=external,cn=auth"
  read by dn.base="cn=Manager,$OU,$DN" read by * none

dn: olcDatabase={2}mdb,cn=config
changetype: modify
replace: olcSuffix
olcSuffix: o=pku

dn: olcDatabase={2}mdb,cn=config
changetype: modify
replace: olcRootDN
olcRootDN: cn=Manager,$OU,$DN

dn: olcDatabase={2}mdb,cn=config
changetype: modify
add: olcRootPW
olcRootPW: $pw

dn: olcDatabase={2}mdb,cn=config
changetype: modify
add: olcAccess
olcAccess: {0}to attrs=userPassword,shadowLastChange by
  dn="cn=Manager,$OU,$DN" write by anonymous auth by self write by * none
olcAccess: {1}to dn.base="" by * read
olcAccess: {2}to * by dn="cn=Manager,$OU,$DN" write by * read
EOF
echo "modify chdomain.ldif"
ldapmodify -Y EXTERNAL -H ldapi:/// -f /etc/openldap/chdomain.ldif

cat >>/etc/openldap/basedomain.ldif <<EOF
dn: $DN
objectClass: top
objectclass: organization
o: $dn

dn: $OU,$DN
objectClass: organizationalUnit
ou: $ou

dn: cn=Manager,$OU,$DN
objectClass: organizationalRole
cn: Manager
description: Directory Manager

dn: ou=People,$OU,$DN
objectClass: organizationalUnit
ou: People

dn: ou=Group,$OU,$DN
objectClass: organizationalUnit
ou: Group
EOF
ldapadd -x -D cn=Manager,$OU,$DN -w $adminPasswd -f /etc/openldap/basedomain.ldif

#############################
#[6] Configure LDAP Provider. Add syncprov module.
echo "Step 6:Configure LDAP Provider. Add syncprov module."
cat >>/etc/openldap/mod_syncprov.ldif <<EOF
dn: cn=module,cn=config
objectClass: olcModuleList
cn: module
olcModulePath: /usr/lib64/openldap
olcModuleLoad: syncprov.la
EOF
ldapadd -Y EXTERNAL -H ldapi:/// -f /etc/openldap/mod_syncprov.ldif

cat >>/etc/openldap/syncprov.ldif <<EOF
dn: olcOverlay=syncprov,olcDatabase={2}mdb,cn=config
objectClass: olcOverlayConfig
objectClass: olcSyncProvConfig
olcOverlay: syncprov
olcSpSessionLog: 100
EOF
ldapadd -Y EXTERNAL -H ldapi:/// -f /etc/openldap/syncprov.ldif


#[7] Configure LDAP Provider. Add ppolicy module.
echo "Step 7:Configure LDAP Provider. Add ppolicy module."
cat << EOF | ldapadd -Y EXTERNAL -H ldapi:///
dn: cn=module{0},cn=config
changetype: modify
add: olcModuleLoad
olcModuleLoad: ppolicy.la
EOF
ldapadd -Y EXTERNAL -H ldapi:/// -f /etc/openldap/schema/ppolicy.ldif

cat << EOF | ldapadd -Y EXTERNAL -H ldapi:///
dn: olcOverlay=ppolicy,olcDatabase={2}mdb,cn=config
changetype: add
objectClass: olcOverlayConfig
objectClass: olcPPolicyConfig
olcOverlay: ppolicy
olcPPolicyDefault: cn=default,ou=pwpolicies,$DN
EOF

cat << EOF | ldapadd -x -D "cn=Manager,$OU,$DN" -w admin -H ldap://localhost
dn: ou=pwpolicies,$DN
ou: pwpolicies
objectClass: organizationalUnit
EOF

cat << EOF | ldapadd -x -D "cn=Manager,$OU,$DN" -w admin -H ldap://localhost
dn: cn=default,ou=pwpolicies,$DN
cn: default
objectClass: pwdPolicy
objectClass: person
pwdAttribute: userPassword
pwdMaxFailure: 3
pwdLockoutDuration: 0
pwdLockout: TRUE
sn: dummy value
EOF

#[8] create SSL certificates
: <<!
Country="CN"
Province="Beijing"
Locality="Beijing"
OrganName="PKU"
OrganUnit="HPC pku"
CommonName="hpc.pku.edu.cn"
EmailAddr="xxx@hpc.pku.edu.cn"
Phrase="wrongpassword"
!

echo "Step 8:create SSL certificates"

openssl req -out /etc/pki/tls/certs/server.csr -new -newkey rsa:2048 -nodes -keyout /etc/pki/tls/certs/server.key \
  -subj "/C=$Country/ST=$Province/L=$Locality/O=$OrganName/CN=$CommonName/emailAddress=$EmailAddr"

mkdir -p /etc/openldap/certs/

openssl x509 -in /etc/pki/tls/certs/server.csr -out /etc/pki/tls/certs/server.crt -req -signkey /etc/pki/tls/certs/server.key -days 3650

cp /etc/pki/tls/certs/server.key \
  /etc/pki/tls/certs/server.crt \
  /etc/pki/tls/certs/ca-bundle.crt \
  /etc/openldap/certs/

chown ldap. /etc/openldap/certs/server.key \
  /etc/openldap/certs/server.crt \
  /etc/openldap/certs/ca-bundle.crt

>/etc/pki/tls/certs/mod_ssl.ldif
cat >>/etc/pki/tls/certs/mod_ssl.ldif <<EOF
dn: cn=config
changetype: modify
add: olcTLSCACertificateFile
olcTLSCACertificateFile: /etc/openldap/certs/ca-bundle.crt
-
replace: olcTLSCertificateFile
olcTLSCertificateFile: /etc/openldap/certs/server.crt
-
replace: olcTLSCertificateKeyFile
olcTLSCertificateKeyFile: /etc/openldap/certs/server.key
EOF

ldapmodify -Y EXTERNAL -H ldapi:/// -f /etc/pki/tls/certs/mod_ssl.ldif

if [ -z "$IN_DOCKER" ]; then
  systemctl restart slapd
fi



echo "finished!"
