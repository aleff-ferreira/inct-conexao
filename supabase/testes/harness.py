#!/usr/bin/env python3
"""sql_harness.py — sobe um Postgres descartável (pgserver), instala o dublê do
Supabase e aplica 001..004 (+005, se existir). Reporta a saída real do psql."""
import os, shutil, subprocess, sys, pathlib

SITE = "/tmp/sql_site"
sys.path.insert(0, SITE)
import pgserver  # noqa: E402

SCRATCH = pathlib.Path("/mnt/c/Users/aleff/AppData/Local/Temp/claude/"
                       "--wsl-localhost-ubuntu-home-aleff-inct/"
                       "a97d7085-e58a-4064-908a-da31089a446b/scratchpad")
REPO = pathlib.Path("/home/aleff/inct")
PGDATA = pathlib.Path("/tmp/sql_pgdata")
WORK = pathlib.Path("/tmp/sql_work")

STEPS = [
    ("stub", SCRATCH / "sql_stub_supabase.sql"),
    # 001 roda DUAS vezes de propósito: na 1ª passada a policy da linha 30 falha
    # (usa public.is_admin(), que só é criada na linha 77) — é um defeito real do
    # 001, não do harness. Sem ON_ERROR_STOP a 1ª passada cria todo o resto; a 2ª
    # passada, já com is_admin() existindo, fecha o estado igual ao de produção.
    ("001-passada1-sem-error-stop", REPO / "supabase/migrations/001_platform.sql"),
    ("001", REPO / "supabase/migrations/001_platform.sql"),
    ("002", REPO / "supabase/migrations/002_staff_allowlist.sql"),
    ("003", REPO / "supabase/migrations/003_protocolo_atomico.sql"),
    ("004", REPO / "supabase/migrations/004_evaluation_audit_log.sql"),
    ("patch", REPO / "supabase/patch-2026-07-add-felipe.sql"),
    ("005", REPO / "supabase/migrations/005_relatos.sql"),
    # idempotência: rodar de novo não pode explodir nem duplicar nada
    ("005-reaplicado", REPO / "supabase/migrations/005_relatos.sql"),
]


def main():
    fresh = "--keep" not in sys.argv
    if fresh and PGDATA.exists():
        shutil.rmtree(PGDATA, ignore_errors=True)
    PGDATA.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    srv = pgserver.get_server(str(PGDATA), cleanup_mode=None)
    print("== servidor ==")
    print(srv.psql("select version();").strip())
    ok = True
    for name, path in STEPS:
        if not path.exists():
            print(f"\n---- {name}: ARQUIVO AUSENTE ({path}) — pulado")
            continue
        sql = path.read_text(encoding="utf-8")
        tmp = WORK / f"{name}.sql"
        # ON_ERROR_STOP + eco de erro: rodamos via psql -f com -v ON_ERROR_STOP=1
        tmp.write_text(sql, encoding="utf-8")
        env = dict(os.environ)
        env["PGDATA"] = str(PGDATA)
        stop = [] if "sem-error-stop" in name else ["-v", "ON_ERROR_STOP=1"]
        cmd = [str(pathlib.Path(pgserver.__file__).parent / "pginstall/bin/psql"),
               srv.get_uri(), *stop, "-X", "-q", "-f", str(tmp)]
        r = subprocess.run(cmd, capture_output=True, text=True, env=env)
        status = "OK" if r.returncode == 0 else f"FALHOU (rc={r.returncode})"
        print(f"\n---- {name}: {status}")
        if r.stdout.strip():
            print(r.stdout.strip()[:6000])
        if r.stderr.strip():
            print("stderr:")
            print(r.stderr.strip()[:6000])
        if r.returncode != 0 and "sem-error-stop" not in name:
            ok = False
            if name != "005":
                break
    print("\n== resultado geral:", "TUDO APLICOU" if ok else "houve falha")


if __name__ == "__main__":
    main()
