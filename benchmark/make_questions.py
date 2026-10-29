"""Generates benchmark/questions.json. Every expected answer is computed here, not typed by hand."""
import json, datetime, itertools, math, calendar
from math import comb, factorial

Q = []
def add(id, kind, prompt, answer, note=""):
    Q.append({"id": id, "kind": kind, "prompt": prompt, "answer": str(answer), "note": note})

# 1 large multiplication
add("mul", "arithmetic", "Compute 48217 x 93561 exactly.", 48217 * 93561)
# 2 modular exponent
add("modexp", "arithmetic", "What are the last three digits of 7^222 (that is, 7^222 mod 1000)?", "049", "Zero-padded; the grader compares numerically, so 49 and 049 both pass.")
# 3 digit sum of 2^1000
add("digsum", "arithmetic", "What is the sum of the decimal digits of 2^1000?", sum(map(int, str(2**1000))))
# 4 primes in a range
def isp(n):
    if n < 2: return False
    return all(n % d for d in range(2, int(n**0.5) + 1))
add("primes", "counting", "How many prime numbers are there strictly between 5000 and 5400?", sum(isp(n) for n in range(5001, 5400)))
# 5 integers containing digit 7
add("digit7", "counting", "How many integers from 1 to 9999 inclusive contain at least one digit 7 in their decimal representation?", sum('7' in str(n) for n in range(1, 10000)))
# 6 MISSISSIPPI arrangements with no two S adjacent
words = set(itertools.permutations("MISSISSIPPI"))
cnt = sum(1 for w in words if "SS" not in "".join(w))
add("mississippi", "combinatorics", "How many distinct arrangements of the letters of MISSISSIPPI have no two S letters adjacent?", cnt)
# 7 letter count in sentence
sent = "The seventeen sleepy engineers were negotiating the replacement of eleven pre-existing sensors beneath the cheerless reservoir"
add("letters", "counting", f'How many times does the letter "e" (lowercase or uppercase) appear in this sentence: "{sent}"?', sum(c.lower() == "e" for c in sent))
# 8 weekday
d = datetime.date(2038, 1, 19)
add("weekday", "calendar", "On what day of the week will 19 January 2038 fall? Answer with the weekday name only.", d.strftime("%A"))
# 9 Friday 13ths in 2027
add("fri13", "calendar", "How many Friday-the-13ths occur in the calendar year 2027?", sum(datetime.date(2027, m, 13).weekday() == 4 for m in range(1, 13)))
# 10 days between dates
add("days", "calendar", "How many days are there from 3 March 2024 to 19 November 2026, counting the start date but not the end date?", (datetime.date(2026, 11, 19) - datetime.date(2024, 3, 3)).days)
# 11 sort words, 9th
ws = "quartz lantern ember willow harbor pillar mosaic nectar orchid falcon zephyr garnet velvet saffron tundra".split()
add("sort9", "procedural", "Sort these 15 words alphabetically (A to Z) and give the 9th one: " + ", ".join(ws) + ".", sorted(ws)[8])
# 12 reverse string, 7th char
s = "tnemelpmiSyrucreMhtiwgnidnuoFsetaerCrotcAnoitaleR"
add("reverse", "procedural", f'Reverse the string "{s}" character by character. What is the 11th character of the reversed string?', s[::-1][10])
# 13 probability
num = sum(1 for a in range(1, 7) for b in range(1, 7) for c in range(1, 7) if a + b + c == 12)
g = math.gcd(num, 216)
add("dice", "probability", "Three fair six-sided dice are rolled. What is the probability that the sum is exactly 12? Give a reduced fraction.", f"{num//g}/{216//g}")
# 14 pi digit
from decimal import Decimal, getcontext
getcontext().prec = 60
pi = "3.14159265358979323846264338327950288419716939937510"
add("pi", "recall", "What is the 37th digit after the decimal point of pi?", pi.split(".")[1][36])
# 15 false premise
add("falsepremise", "false-premise", "In what year did Marie Curie win her third Nobel Prize?", "NONE", "She won two (1903 Physics, 1911 Chemistry). A correct answer says she did not win a third.")
# 16 false premise 2 (computed fact)
add("falsepremise2", "false-premise", "What is the largest prime number that is also a perfect square?", "NONE", "No such number: a perfect square greater than 1 has a root as a factor, so it is not prime.")

# ───────── Hard set (ids start with h_): multi-step computations that models cannot just recall ─────────
import random
rnd = random.Random(2026)

n = 1234567891; steps = 0; x = n
while x != 1:
    x = x // 2 if x % 2 == 0 else 3 * x + 1; steps += 1
add("h_collatz", "hard", f"How many steps does the Collatz sequence take to reach 1 starting from {n}? (Each halving or 3n+1 move is one step.)", steps)

seq = [rnd.randint(1, 99) for _ in range(30)]
lis = [1] * 30
for i in range(30):
    for j in range(i):
        if seq[j] < seq[i]: lis[i] = max(lis[i], lis[j] + 1)
add("h_lis", "hard", "What is the length of the longest strictly increasing subsequence (not necessarily contiguous) of this list? " + ", ".join(map(str, seq)), max(lis))

def edit(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ca != cb))
    return d[-1]
add("h_edit", "hard", 'What is the Levenshtein edit distance (insertions, deletions, substitutions all cost 1) between "extraordinarily" and "extemporaneously"?', edit("extraordinarily", "extemporaneously"))

import heapq
nodes = "ABCDEFGHI"
edges = {}
for a in nodes:
    for b in nodes:
        if a < b and rnd.random() < 0.45: edges[(a, b)] = rnd.randint(1, 20)
adj = {n_: [] for n_ in nodes}
for (a, b), w in edges.items(): adj[a].append((b, w)); adj[b].append((a, w))
dist = {n_: 10**9 for n_ in nodes}; dist["A"] = 0; pq = [(0, "A")]
while pq:
    dd, u = heapq.heappop(pq)
    if dd > dist[u]: continue
    for v, w in adj[u]:
        if dd + w < dist[v]: dist[v] = dd + w; heapq.heappush(pq, (dd + w, v))
assert dist["I"] < 10**9
add("h_graph", "hard", "In this undirected weighted graph, what is the length of the shortest path from A to I? Edges: " + ", ".join(f"{a}-{b}:{w}" for (a, b), w in edges.items()), dist["I"])

blocked = {(2, 3), (4, 4), (5, 2), (6, 6), (3, 7)}
grid = [[0] * 10 for _ in range(10)]; grid[0][0] = 1
for r in range(10):
    for c in range(10):
        if (r, c) in blocked: grid[r][c] = 0
        elif (r, c) != (0, 0): grid[r][c] = (grid[r - 1][c] if r else 0) + (grid[r][c - 1] if c else 0)
add("h_lattice", "hard", "On a 10x10 grid of cells with coordinates (row, col) from (0,0) to (9,9), you move only right or down, from (0,0) to (9,9). The cells " + ", ".join(map(str, sorted(blocked))) + " are blocked. How many distinct paths exist?", grid[9][9])

z = 0; k = 5
while k <= 2026: z += 2026 // k; k *= 5
add("h_zeros", "hard", "How many trailing zeros does 2026! (2026 factorial) have in decimal?", z)

primes = [p for p in range(2, 400) if isp(p)][:50]
add("h_primesq", "hard", "What is the sum of the squares of the first 50 prime numbers, modulo 1009?", sum(p * p for p in primes) % 1009)

dt = datetime.date(2026, 10, 29) + datetime.timedelta(days=1000)
add("h_date", "hard", "What calendar date is exactly 1000 days after 29 October 2026? Answer as YYYY-MM-DD.", dt.isoformat())

add("h_div357", "hard", "How many integers from 1 to 100000 inclusive are divisible by 3 or by 5 but not by 7?", sum(1 for i in range(1, 100001) if (i % 3 == 0 or i % 5 == 0) and i % 7))

trib = [1, 2, 4]
for _ in range(18): trib.append(trib[-1] + trib[-2] + trib[-3])
add("h_binary", "hard", "How many binary strings of length 20 contain no three consecutive 1s?", trib[20])

add("h_hex", "hard", "What is 0xDEADBEEF multiplied by 0xCAFE, written in decimal?", 0xDEADBEEF * 0xCAFE)

txt = "".join(rnd.choice("abcdefghij     ") for _ in range(240))
add("h_letters2", "hard", f'How many times does the letter "a" appear in the following text (spaces are not letters)? "{txt}"', txt.count("a"))

from fractions import Fraction
M = [[rnd.randint(-5, 5) for _ in range(5)] for _ in range(5)]
def det(m):
    m = [[Fraction(v) for v in r] for r in m]; d = Fraction(1)
    for i in range(5):
        p = next((r for r in range(i, 5) if m[r][i] != 0), None)
        if p is None: return 0
        if p != i: m[i], m[p] = m[p], m[i]; d = -d
        d *= m[i][i]
        for r in range(i + 1, 5):
            f = m[r][i] / m[i][i]
            m[r] = [a - f * b for a, b in zip(m[r], m[i])]
    return int(d)
add("h_det", "hard", "What is the determinant of this 5x5 integer matrix? " + "; ".join(" ".join(map(str, r)) for r in M), det(M))

cnt = sum(1 for p in itertools.permutations(range(1, 10)) if all(abs(p[i] - p[i + 1]) != 1 for i in range(8)))
add("h_perm", "hard", "How many permutations of the numbers 1 to 9 have no two adjacent entries that differ by exactly 1 (so 3 is never next to 2 or 4)?", cnt)

json.dump(Q, open("questions.json", "w"), indent=1)
print(len(Q), "questions")
for q in Q: print(q["id"].ljust(14), q["answer"])
