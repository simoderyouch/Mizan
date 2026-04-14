#!/bin/bash

# Configuration
if [ -f .env.compose ]; then
    export $(grep -v '^#' .env.compose | xargs)
fi

DOMAIN=${DOMAIN:-example.com}
EMAIL=${EMAIL:-admin@$DOMAIN}
STAGING=${STAGING:-0} # Set to 1 for testing with Let's Encrypt staging environment

if [ "$DOMAIN" = "example.com" ]; then
    echo "Error: Please set DOMAIN in .env.compose"
    exit 1
fi

echo "### Starting SSL initialization for $DOMAIN..."

# Create necessary directories
mkdir -p docker/nginx/conf.d
mkdir -p docker/nginx/certbot/conf
mkdir -p docker/nginx/certbot/www

# Prepare Nginx config from template
echo "### Preparing Nginx configuration..."
sed "s/\${DOMAIN}/$DOMAIN/g" docker/nginx/conf.d/mizan.conf.template > docker/nginx/conf.d/mizan.conf

# Download recommended TLS parameters if they don't exist
if [ ! -e "docker/nginx/conf.d/options-ssl-nginx.conf" ]; then
  echo "### Downloading recommended TLS parameters..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > docker/nginx/conf.d/options-ssl-nginx.conf
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > docker/nginx/conf.d/ssl-dhparams.pem
fi

# Initial dummy certificate for Nginx startup (if no real cert exists)
if [ ! -d "docker/nginx/certbot/conf/live/mizan.$DOMAIN" ]; then
    echo "### Creating dummy certificate for mizan.$DOMAIN..."
    path="/etc/letsencrypt/live/mizan.$DOMAIN"
    docker compose run --rm --entrypoint \
      "sh -c 'mkdir -p $path && \
       openssl req -x509 -nodes -newkey rsa:2048 -days 1\
         -keyout $path/privkey.pem \
         -out $path/fullchain.pem \
         -subj \"/CN=localhost\"'" certbot
fi

echo "### Starting nginx..."
docker compose up --force-recreate -d nginx

# Delete dummy certificate
echo "### Deleting dummy certificate..."
docker compose run --rm --entrypoint \
  "rm -rf /etc/letsencrypt/live/mizan.$DOMAIN /etc/letsencrypt/archive/mizan.$DOMAIN /etc/letsencrypt/renewal/mizan.$DOMAIN.conf" certbot

echo "### Requesting real Let's Encrypt certificate for $DOMAIN..."
# Requesting for subdomains (excluding base domain as it is on Vercel)
domain_args="-d mizan.$DOMAIN -d mizanm.$DOMAIN -d api.$DOMAIN"

# Select appropriate email arg
case "$EMAIL" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $EMAIL" ;;
esac

# Enable staging mode if requested
if [ $STAGING != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint \
  "certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size 2048 \
    --agree-tos \
    --force-renewal \
    --non-interactive" certbot

echo "### Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "### SSL setup complete!"
