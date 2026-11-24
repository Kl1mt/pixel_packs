# T17 character & idle-animation trial — review

Board (animated, 3×): [`board.png`](board.png). Rows: Morel low top-down · Morel side · Umbra low top-down · Umbra side. Columns: card art · south rotation · east rotation · idle south (binder) · idle east · walk east · attack east · hurt east. The red line marks each cell's frame-1 feet row.

Per-animation previews (4×): `<character>/<anim>-<dir>/preview.png`; frames `NN.png`; strip `sheet.png`; rotations in `<character>/rotations/`.

Spend: 24 generations (4 characters + 20 animations, 1 each). Rotations come back at 64×64; animations widen the canvas to 84×84 or 88×88.

## Measured consistency (`artgen character-board`)
Feet y = bottom opaque row of each frame (lower variance = steadier baseline).

```
mos-012-low-idle-south     4f 88x88 feet y 73,73,73,73 · bbox w 33–34 h 59–61 · 11 colours
mos-012-low-idle-east      4f 84x84 feet y 71,70,70,71 · bbox w 26–27 h 60–61 · 9 colours
mos-012-low-walk-east      6f 84x84 feet y 71,70,71,71,71,71 · bbox w 26–26 h 59–61 · 9 colours
mos-012-low-attack-east    6f 84x84 feet y 70,70,70,70,70,70 · bbox w 27–28 h 58–60 · 9 colours
mos-012-low-hurt-east      4f 84x84 feet y 70,69,69,69 · bbox w 26–37 h 56–59 · 10 colours
mos-012-side-idle-south    4f 88x88 feet y 73,73,73,73 · bbox w 32–34 h 58–61 · 11 colours
mos-012-side-idle-east     4f 88x88 feet y 73,71,72,74 · bbox w 27–27 h 60–61 · 10 colours
mos-012-side-walk-east     6f 88x88 feet y 73,73,73,73,73,73 · bbox w 27–29 h 59–60 · 11 colours
mos-012-side-attack-east   6f 88x88 feet y 73,73,73,74,74,74 · bbox w 27–37 h 57–61 · 11 colours
mos-012-side-hurt-east     4f 88x88 feet y 73,73,73,73 · bbox w 36–41 h 57–60 · 11 colours
sta-013-low-idle-south     4f 88x88 feet y 74,74,74,74 · bbox w 53–53 h 59–62 · 9 colours
sta-013-low-idle-east      4f 88x88 feet y 72,72,72,72 · bbox w 55–55 h 58–59 · 9 colours
sta-013-low-walk-east      6f 88x88 feet y 72,72,72,72,72,72 · bbox w 51–54 h 58–59 · 9 colours
sta-013-low-attack-east    6f 88x88 feet y 72,72,73,73,72,72 · bbox w 54–56 h 55–59 · 13 colours
sta-013-low-hurt-east      4f 88x88 feet y 72,72,72,72 · bbox w 52–72 h 54–59 · 10 colours · TOUCHES EDGE
sta-013-side-idle-south    4f 88x88 feet y 74,74,74,74 · bbox w 52–53 h 59–62 · 13 colours
sta-013-side-idle-east     4f 88x88 feet y 74,74,74,74 · bbox w 51–51 h 61–64 · 10 colours
sta-013-side-walk-east     6f 88x88 feet y 75,75,73,72,73,75 · bbox w 46–49 h 57–64 · 10 colours
sta-013-side-attack-east   6f 88x88 feet y 74,74,74,74,74,74 · bbox w 47–53 h 59–62 · 10 colours
sta-013-side-hurt-east     4f 88x88 feet y 74,74,74,74 · bbox w 51–51 h 59–61 · 12 colours
```
