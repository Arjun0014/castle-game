"""Line-ending guard: every changed text file keeps the line endings it has at HEAD (CRLF or LF).

python tools/eol_check.py          report files whose endings differ from HEAD (and mixed files)
python tools/eol_check.py --fix    rewrite them with HEAD's convention (new files: LF)
"""
import subprocess
import sys

TEXT = ('.ts', '.js', '.mjs', '.css', '.html', '.json', '.md', '.py', '.txt')


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, check=True).stdout


def main():
    fix = '--fix' in sys.argv
    changed = [l[3:] for l in git('status', '--porcelain').decode('utf-8').splitlines() if l[:2].strip() in ('M', 'AM', 'MM')]
    for f in changed:
        if not f.endswith(TEXT):
            continue
        try:
            head = git('show', f'HEAD:{f}')
        except subprocess.CalledProcessError:
            continue
        cur = open(f, 'rb').read()
        head_crlf = head.count(b'\r\n') > head.count(b'\n') / 2
        n_lf = cur.count(b'\n')
        n_crlf = cur.count(b'\r\n')
        cur_crlf = n_crlf > n_lf / 2
        mixed = 0 < n_crlf < n_lf
        if head_crlf != cur_crlf or mixed:
            print(f'{f}: HEAD {"CRLF" if head_crlf else "LF"}, now {"mixed" if mixed else ("CRLF" if cur_crlf else "LF")}')
            if fix:
                body = cur.replace(b'\r\n', b'\n')
                if head_crlf:
                    body = body.replace(b'\n', b'\r\n')
                open(f, 'wb').write(body)
                print('  fixed')


if __name__ == '__main__':
    main()
