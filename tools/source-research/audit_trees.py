#!/usr/bin/env python3
"""Independently reconcile the lossless original Git-tree archive and pins."""
import collections
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess


def audit(root):
    root=Path(root).resolve()
    evidence=root/'evidence/source-research'
    report=json.loads((evidence/'git-tree-audit.json').read_text())
    archive=evidence/'pinned-git-trees.jsonl.gz'
    h=hashlib.sha256()
    with archive.open('rb') as stream:
        while block:=stream.read(1024*1024):
            h.update(block)
    if h.hexdigest()!=report['pinned_git_trees_archive_sha256']:
        raise RuntimeError('Tree archive checksum mismatch')
    expected={e['repository']:e for e in report['repositories']}
    expected['.']={'repository':'.',**report['ocade_tree']}
    streams={name:hashlib.sha256() for name in expected}
    counts={name:collections.Counter() for name in expected}
    seen_pins={}
    with gzip.open(archive,'rt',encoding='utf-8') as stream:
        for line in stream:
            row=json.loads(line)
            repo=row['repository']
            if row['pin']!=expected[repo]['pin']:
                raise RuntimeError('Archive pin mismatch: '+repo)
            raw=(row['mode']+' '+row['type']+' '+row['git_oid']+'\t').encode()+os.fsencode(row['path'])+b'\0'
            streams[repo].update(raw)
            counts[repo][row['type']]+=1
    for name,entry in expected.items():
        if streams[name].hexdigest()!=entry['tree_listing_sha256'] or counts[name]!=entry['counts']:
            raise RuntimeError('Archive has missing, duplicate or altered entries: '+name)
        path=root/name
        actual=subprocess.check_output(['git','-C',str(path),'ls-tree','-rtz',entry['pin']])
        if hashlib.sha256(actual).hexdigest()!=streams[name].hexdigest():
            raise RuntimeError('Original Git tree differs: '+name)
        if name!='.':
            head=subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD'],text=True).strip()
            if head!=entry['pin']:
                raise RuntimeError('Current submodule pin differs: '+name)
            seen_pins[name]=head
    # Read the parent's committed Git tree independently of the research manifest.
    parent=subprocess.check_output(['git','-C',str(root),'ls-tree','-rz','HEAD'])
    actual_links={}
    for record in parent.split(b'\0'):
        if record:
            metadata,path=record.split(b'\t',1)
            mode,kind,oid=metadata.decode().split()
            if mode=='160000':
                actual_links[os.fsdecode(path)]=oid
    if actual_links!=seen_pins:
        raise RuntimeError('Parent gitlinks differ from the 243 original pinned repositories')
    return dict(integrity='PASS',top_level_pins_verified=len(seen_pins),
                original_git_entries=sum(sum(c.values()) for c in counts.values()),
                source_file_hash_inventory_complete=False,delivery_complete=False,acknowledgment_complete=False,
                scope='Original Git trees and current top-level pins only; not source reading coverage')


if __name__=='__main__':
    print(json.dumps(audit(Path(__file__).resolve().parents[2]),sort_keys=True))
