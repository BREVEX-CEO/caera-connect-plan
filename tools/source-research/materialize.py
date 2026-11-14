#!/usr/bin/env python3
"""Retry materialization without changing gitlinks, source files or prior receipts."""
import argparse
import concurrent.futures
import datetime
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import threading


def command(path, arguments, timeout):
    env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GIT_LFS_SKIP_SMUDGE': '1',
           'GIT_SSH_COMMAND': 'ssh -o BatchMode=yes -o ConnectTimeout=15'}
    process = subprocess.Popen(['git', '-C', str(path), '-c', 'core.hooksPath=/dev/null',
                                '-c', 'protocol.file.allow=never', '-c', 'protocol.ext.allow=never',
                                *arguments], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               env=env, start_new_session=True)
    try:
        out, err = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
        return dict(status='blocked', reason='Deadline; child process group terminated. Retry required.')
    # Preserve the entire diagnostic; large output is a local evidence artifact.
    return dict(status='pass' if process.returncode == 0 else 'failed', returncode=process.returncode,
                stdout=out.decode('utf-8', 'replace'), stderr=err.decode('utf-8', 'replace'))


def materialize(root, output, jobs=2, timeout=300, reserve=512*1024**2):
    root, output = Path(root).resolve(), Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    entries = json.loads((root/'all-repos/submodule-verification.json').read_text())['entries']
    entries = [e for e in entries if e['status'] == 'verified']
    report = dict(attempted_complete=False, materialization_complete=False, repositories={},
                  policy='Pinned worktrees only; no source code execution; no deletion; no branch changes.')
    if output.exists():
        previous = json.loads(output.read_text())
        report['previous_report_sha256'] = __import__('hashlib').sha256(output.read_bytes()).hexdigest()
        history = output.with_name(output.stem + '-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.json')
        shutil.copyfile(output, history)
        report['previous_report'] = str(history)
    lock = threading.Lock()
    def job(entry):
        path = root/entry['path']
        pin = subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD'],text=True).strip()
        if pin != entry['commit']:
            return dict(path=entry['path'],pin=pin,steps=[dict(step='pin',status='blocked',reason='Pin mismatch; no mutation attempted')])
        steps = []
        # Disk reservations are serialized across mutations to avoid multiple
        # workers simultaneously spending the same reserve. Git's own nested
        # clone jobs can still run concurrently inside an operation.
        for name, args in [('sparse',['sparse-checkout','disable']), ('lfs',['lfs','pull']),
                           ('nested',['submodule','update','--init','--recursive','--checkout','--depth=1','--jobs=2'])]:
            with lock:
                if shutil.disk_usage(root).free < reserve:
                    result = dict(status='blocked', reason='Insufficient free disk reserve; original files preserved')
                else:
                    result = command(path, args, timeout)
            steps.append(dict(step=name, **result))
        # Nested repositories also need sparse/LFS hydration, not only gitlinks.
        if all(s['status'] == 'pass' for s in steps):
            with lock:
                nested = (command(path, ['submodule','foreach','--recursive',
                                  'git sparse-checkout disable && git lfs pull'], timeout)
                          if shutil.disk_usage(root).free >= reserve else
                          dict(status='blocked',reason='Insufficient disk reserve for nested LFS payloads'))
            steps.append(dict(step='nested_lfs', **nested))
        return dict(number=entry['number'],path=entry['path'],pin=pin,steps=steps)
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
        for entry, result in zip(entries, pool.map(job, entries)):
            report['repositories'][str(entry['number'])] = result
            report['updated_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            temporary = output.with_suffix('.tmp')
            temporary.write_text(json.dumps(report,indent=2)+'\n')
            os.replace(temporary,output)
            print(entry['number'],[s['status'] for s in result['steps']],flush=True)
    report['attempted_complete'] = len(report['repositories']) == len(entries)
    report['materialization_complete'] = report['attempted_complete'] and all(
        all(s['status']=='pass' for s in r['steps']) for r in report['repositories'].values())
    output.write_text(json.dumps(report,indent=2)+'\n')
    return report


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output',type=Path)
    parser.add_argument('--timeout',type=int,default=300)
    parser.add_argument('--jobs',type=int,choices=range(1,5),default=2)
    args=parser.parse_args()
    report=materialize(args.root,args.output or args.root/'.source-research/materialization.json',args.jobs,args.timeout)
    raise SystemExit(0 if report['materialization_complete'] else 2)
