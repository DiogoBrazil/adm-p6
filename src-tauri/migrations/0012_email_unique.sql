-- Indice unico parcial: so aplica quando email nao eh nulo
CREATE UNIQUE INDEX uix_email ON usuarios (lower(email)) WHERE email IS NOT NULL;
