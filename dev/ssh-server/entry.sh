mkdir -p /home/test/.ssh
mkdir -p /root/.ssh

function addPublicKey {
  echo "Adding public key to both root and test users"

  echo "$@" >>/home/test/.ssh/authorized_keys

  echo "$@" >>/root/.ssh/authorized_keys
}

if [ "$SSH_AUTHORIZED_PUBLIC_KEY" != "" ]; then
  echo "Adding the value of env SSH_AUTHORIZED_PUBLIC_KEY as an authorized key..."

  addPublicKey "$SSH_AUTHORIZED_PUBLIC_KEY"
else
  echo "No SSH_AUTHORIZED_PUBLIC_KEY found. Skipping setup public key auth via env"
fi

if [ -f /id_rsa.pub ]; then
  echo "Found /id_rsa.pub. Adding it as an authorized key..."

  id_rsa_pub=$(cat /id_rsa.pub)

  echo "$id_rsa_pub"

  addPublicKey $id_rsa_pub
else
  echo "No /id_rsa.pub found. Skipping setup public key auth."
fi

chown -R root: /root/.ssh/
chown -R test: /home/test/.ssh/

if [ -n "$SSH_PORT" ]; then
  echo -e "Port $SSH_PORT\n" >>/etc/ssh/sshd_config
fi

/usr/sbin/sshd -D
