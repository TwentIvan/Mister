## 1. Principi

1. **Una sola fonte di verità per ogni "lettera".** Token in `tokens.css`. Componenti definiti una volta nel modulo 06. Le schermate **usano**, non ridefiniscono.
2. **Se cambi una lettera, si propaga.** Per i token: `tokens.css` + `propaga.py` (tecnico). Per componenti/regole/architettura: il **registro** + la **Matrice (09)** dicono dove guardare; `genera.py` rivalida e rigenera.
3. **Verificare la resa, non solo che compili.** I mockup vanno guardati renderizzati; le correzioni si fanno alla fonte (token/componente), non con pezze locali.

Maturità: alfabeto e schermate esistono come mockup statici, dati e loghi **segnaposto**. Restano test e integrazione runtime.
