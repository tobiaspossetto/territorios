#!/bin/bash
# La V2 no reutiliza el flujo de despliegue de la aplicación original.
# Antes de publicar se debe crear y autorizar el sitio Firebase independiente
# `territorios-este-sf-v2`. Este bloqueo evita sobrescribir producción por error.
set -e

echo "Deploy bloqueado: configurá primero el hosting independiente territorios-este-sf-v2."
exit 1
