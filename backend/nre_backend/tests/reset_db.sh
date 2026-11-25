#!/bin/sh
# Recreate throwaway test DB from the two SQL files. Usage: reset_db.sh <schema.sql> <seed.sql>
S="mariadb -S /tmp/my/s.sock -uroot"
$S -e "DROP DATABASE IF EXISTS nre_test; CREATE DATABASE nre_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || exit 1
$S nre_test < "$1" || exit 1
$S nre_test < "$2" || exit 1
