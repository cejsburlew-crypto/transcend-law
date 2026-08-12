FROM php:8.3-cli

RUN apt-get update && apt-get install -y libsqlite3-dev libcurl4-openssl-dev libzip-dev \
    && docker-php-ext-install pdo_sqlite curl zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY composer.json ./
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer \
    && composer install --no-dev --no-interaction

COPY . .

RUN mkdir -p data && chmod 777 data

EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]
