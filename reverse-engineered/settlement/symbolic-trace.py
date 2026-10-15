import json
from pathlib import Path
p=json.loads(Path('reverse-engineered/settlement/probe-debug_traceCall.json').read_text())
logs=p['response']['result']['structLogs']; stack=[]; mem={}
for i,l in enumerate(logs):
 op=l['op']; pc=l['pc']; vals=l['stack']; before=list(stack)
 def pop(): return stack.pop() if stack else '?'
 if op.startswith('PUSH'): stack.append(hex(int(logs[i+1]['stack'][-1],16)))
 elif op.startswith('DUP'): stack.append(stack[-int(op[3:])])
 elif op.startswith('SWAP'): n=int(op[4:]);stack[-1],stack[-1-n]=stack[-1-n],stack[-1]
 elif op=='POP': pop()
 elif op=='CALLDATALOAD':
  x=pop(); n=int(vals[-1],16); stack.append(f'a{(n-4)//32}' if n>=4 else 'selector')
 elif op in ['ADD','SUB','MUL','DIV','SDIV','MOD','SMOD','LT','GT','SLT','SGT','EQ','AND','OR','XOR','SHL','SHR','SAR','EXP']:
  x=pop();y=pop(); stack.append(f'{op}({x},{y})')
 elif op in ['NOT','ISZERO']:stack.append(f'{op}({pop()})')
 elif op=='JUMP': pop()
 elif op=='JUMPI': pop();pop()
 elif op=='MSTORE': x=pop();y=pop();mem[int(vals[-1],16)]=y
 elif op=='MLOAD': x=pop();stack.append(mem.get(int(vals[-1],16),'mem?'))
 elif op in ['CALLDATASIZE','ADDRESS','CODESIZE','RETURNDATASIZE']:stack.append(op)
 elif op=='JUMPDEST':pass
 elif op in ['RETURN','REVERT']:pop();pop()
 else: print('UNKNOWN',op);break
 if 0x10a8<=pc<=0x1207:
  print(f'{pc:04x} {op:10s}', ' | '.join(stack))
 if i+1<len(logs) and len(stack)!=len(logs[i+1]['stack']): print('STACKMISMATCH',hex(pc),len(stack),len(logs[i+1]['stack']));break
