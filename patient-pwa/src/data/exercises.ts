export type Category = 'aerobic' | 'resistance' | 'breathing' | 'flexibility' | 'balance';

export interface Exercise {
  code: string;
  name: string;
  category: Category;
  /** YouTube 限定公開の埋め込み URL（https://www.youtube.com/embed/xxxx）または Drive の preview URL。空なら準備中表示 */
  videoUrl: string;
  summary: string;
  steps: string[];
  cautions: string[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  aerobic: '歩く',
  resistance: '筋力',
  breathing: '呼吸',
  flexibility: 'ストレッチ',
  balance: 'バランス'
};

export const EXERCISES: Exercise[] = [
  {
    code: 'walk',
    name: 'ウォーキング',
    category: 'aerobic',
    videoUrl: '',
    summary: '「ややきつい」と感じる速さで歩きます。屋内でその場足踏みでも構いません。',
    steps: ['背筋を伸ばし、腕を軽く振って歩きます', '会話ができる程度の速さを保ちます', '疲れたら休んでから再開して構いません'],
    cautions: ['足のしびれやふらつきがある日は、屋内で手すりのそばで行いましょう', '暑い日は水分を持って行きましょう']
  },
  {
    code: 'squat',
    name: 'スクワット',
    category: 'resistance',
    videoUrl: '',
    summary: '椅子の背やテーブルにつかまって、ゆっくりしゃがんで立ちます。',
    steps: ['足を肩幅に開きます', '3 秒かけてお尻を後ろに引きながら膝を曲げます', '3 秒かけて立ち上がります'],
    cautions: ['膝がつま先より前に出ないようにします', '膝に痛みが出たら浅くするか中止します']
  },
  {
    code: 'heel_raise',
    name: 'かかと上げ',
    category: 'resistance',
    videoUrl: '',
    summary: 'つかまり立ちで、かかとをゆっくり上げ下げします。',
    steps: ['壁や椅子につかまります', '2 秒かけてかかとを上げ、2 秒かけて下ろします'],
    cautions: ['ふらつく場合は両手でしっかりつかまります']
  },
  {
    code: 'chair_stand',
    name: '椅子から立ち上がり',
    category: 'resistance',
    videoUrl: '',
    summary: '椅子に座った状態から、できれば手を使わずに立ち上がります。',
    steps: ['浅めに座り、足を少し引きます', '前に体重を移しながら立ち上がります', 'ゆっくり座ります'],
    cautions: ['難しければ手を使って構いません']
  },
  {
    code: 'wall_pushup',
    name: '壁腕立て',
    category: 'resistance',
    videoUrl: '',
    summary: '壁に手をついて、腕立て伏せのように体を近づけて戻します。',
    steps: ['壁から一歩離れて立ち、肩の高さで両手を壁につけます', '肘を曲げて胸を壁に近づけ、押して戻します'],
    cautions: ['腰が反らないよう、体はまっすぐに保ちます']
  },
  {
    code: 'band_row',
    name: 'ゴムバンド（引く）',
    category: 'resistance',
    videoUrl: '',
    summary: '座ってゴムバンドを足にかけ、肘を後ろに引きます。',
    steps: ['座って足の裏にバンドをかけます', '肩甲骨を寄せるように肘を後ろへ引きます', 'ゆっくり戻します'],
    cautions: ['バンドは病院でお渡ししたものを使ってください']
  },
  {
    code: 'breathing',
    name: '深呼吸',
    category: 'breathing',
    videoUrl: '',
    summary: '鼻から大きく吸って、口からゆっくり吐きます。手術後の肺炎予防につながります。',
    steps: ['楽な姿勢で座ります', '4 秒かけて鼻から吸い、お腹をふくらませます', '6 秒かけて口から細く吐きます'],
    cautions: ['めまいがしたら休みます']
  },
  {
    code: 'spirometer',
    name: '呼吸訓練器',
    category: 'breathing',
    videoUrl: '',
    summary: '病院でお渡しした呼吸訓練器を使います。',
    steps: ['口をしっかりくわえます', 'ゆっくり深く吸い込み、目印を上げます', '数秒止めてから、はずして吐きます'],
    cautions: ['お渡ししていない場合は「深呼吸」だけで構いません']
  },
  {
    code: 'stretch',
    name: 'ストレッチ',
    category: 'flexibility',
    videoUrl: '',
    summary: 'ふくらはぎ・太もも・肩まわりを 20 秒ずつ伸ばします。',
    steps: ['壁に手をつき、片足を後ろに引いてふくらはぎを伸ばします', '座って片足を前に伸ばし、体を前に倒します', '両腕を上げて背伸びをします'],
    cautions: ['反動をつけず、痛くない範囲で行います']
  },
  {
    code: 'balance',
    name: '片足立ち',
    category: 'balance',
    videoUrl: '',
    summary: 'つかまりながら片足で 10 秒立ちます。',
    steps: ['椅子の背や壁のそばに立ちます', '片足を少し浮かせて 10 秒数えます', '反対の足も同様に行います'],
    cautions: ['しびれやふらつきがある日は行いません', '必ずつかまれる場所で行います']
  },
  {
    code: 'step',
    name: '足踏み・踏み台',
    category: 'aerobic',
    videoUrl: '',
    summary: 'その場での足踏み、または低い段の昇り降りを続けます。「ややきつい」と感じる速さを保ちます。',
    steps: ['腕を振りながら、太ももを軽く上げて足踏みします', '段を使う場合は手すりのそばで、上り下りの足を途中で入れ替えます', '息が上がりすぎたら速さを落とします'],
    cautions: ['ふらつく場合は壁や椅子のそばで行います', '膝に痛みが出たら段は使わず足踏みだけにします']
  },
  {
    code: 'seated_march',
    name: '座って足踏み',
    category: 'aerobic',
    videoUrl: '',
    summary: '椅子に座ったまま、太ももを上げて足踏みします。',
    steps: ['背もたれに寄りかからず座ります', '左右交互に太ももを上げます', '腕も振ると効果的です'],
    cautions: ['息が上がりすぎない速さで行います']
  }
];

export const byCode = (code: string) => EXERCISES.find((e) => e.code === code);
