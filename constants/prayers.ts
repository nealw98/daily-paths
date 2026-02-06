/**
 * Al-Anon prayers and recovery-related prayers.
 * Static content displayed on the Prayers screen.
 */

export interface Prayer {
  id: string;
  title: string;
  text: string;
  source?: string;
}

export const PRAYERS: Prayer[] = [
  {
    id: "serenity",
    title: "Serenity Prayer",
    text: "God, grant me the serenity\nto accept the things I cannot change,\ncourage to change the things I can,\nand wisdom to know the difference.",
    source: "Reinhold Niebuhr",
  },
  {
    id: "serenity-extended",
    title: "Serenity Prayer (Extended)",
    text: "God, grant me the serenity\nto accept the things I cannot change,\ncourage to change the things I can,\nand wisdom to know the difference.\n\nLiving one day at a time,\nenjoying one moment at a time;\naccepting hardship as a pathway to peace;\ntaking, as Jesus did,\nthis sinful world as it is,\nnot as I would have it;\ntrusting that You will make all things right\nif I surrender to Your will;\nso that I may be reasonably happy in this life\nand supremely happy with You forever in the next.\n\nAmen.",
    source: "Reinhold Niebuhr",
  },
  {
    id: "st-francis",
    title: "Prayer of St. Francis",
    text: "Lord, make me an instrument of Your peace.\nWhere there is hatred, let me sow love;\nwhere there is injury, pardon;\nwhere there is doubt, faith;\nwhere there is despair, hope;\nwhere there is darkness, light;\nwhere there is sadness, joy.\n\nO Divine Master, grant that I may not so much seek\nto be consoled as to console;\nto be understood as to understand;\nto be loved as to love.\n\nFor it is in giving that we receive;\nit is in pardoning that we are pardoned;\nand it is in dying that we are born to eternal life.\n\nAmen.",
    source: "St. Francis of Assisi",
  },
  {
    id: "third-step",
    title: "Third Step Prayer",
    text: "God, I offer myself to Thee —\nto build with me and to do with me as Thou wilt.\nRelieve me of the bondage of self,\nthat I may better do Thy will.\nTake away my difficulties,\nthat victory over them may bear witness\nto those I would help of Thy Power,\nThy Love, and Thy Way of life.\nMay I do Thy will always!\n\nAmen.",
  },
  {
    id: "seventh-step",
    title: "Seventh Step Prayer",
    text: "My Creator, I am now willing\nthat you should have all of me,\ngood and bad.\nI pray that you now remove from me\nevery single defect of character\nwhich stands in the way\nof my usefulness to you and my fellows.\nGrant me strength, as I go out from here,\nto do your bidding.\n\nAmen.",
  },
  {
    id: "let-go",
    title: "Let Go and Let God",
    text: "To \"let go\" does not mean to stop caring,\nit means I can't do it for someone else.\n\nTo \"let go\" is not to cut myself off,\nit's the realization I can't control another.\n\nTo \"let go\" is not to enable,\nbut to allow learning from natural consequences.\n\nTo \"let go\" is to admit powerlessness,\nwhich means the outcome is not in my hands.\n\nTo \"let go\" is not to try to change or blame another,\nit's to make the most of myself.\n\nTo \"let go\" is not to care for,\nbut to care about.\n\nTo \"let go\" is not to fix,\nbut to be supportive.\n\nTo \"let go\" is not to judge,\nbut to allow another to be a human being.\n\nTo \"let go\" is not to be in the middle arranging all the outcomes,\nbut to allow others to affect their own destinies.\n\nTo \"let go\" is not to deny,\nbut to accept.\n\nTo \"let go\" is not to nag, scold, or argue,\nbut instead to search out my own shortcomings and correct them.\n\nTo \"let go\" is not to criticize and regulate anybody,\nbut to try to become what I dream I can be.\n\nTo \"let go\" is to fear less\nand to love more.",
  },
  {
    id: "just-for-today",
    title: "Just for Today",
    text: "Just for today I will try to live through this day only,\nand not tackle my whole life problem at once.\n\nJust for today I will be happy.\nThis assumes to be true what Abraham Lincoln said,\nthat \"most folks are as happy as they make up their minds to be.\"\n\nJust for today I will adjust myself to what is\nand not try to adjust everything to my own desires.\n\nJust for today I will try to strengthen my mind.\nI will study. I will learn something useful.\nI will not be a mental loafer.\nI will read something that requires effort, thought, and concentration.\n\nJust for today I will exercise my soul in three ways:\nI will do somebody a good turn and not get found out.\nI will do at least two things I don't want to do,\njust for exercise.\n\nJust for today I will be agreeable.\nI will look as well as I can, dress becomingly,\ntalk low, act courteously, criticize not one bit,\nnot find fault with anything,\nand not try to improve or regulate anybody except myself.\n\nJust for today I will have a program.\nI may not follow it exactly, but I will have it.\nI will save myself from two pests: hurry and indecision.\n\nJust for today I will have a quiet half hour all by myself and relax.\nDuring this half hour, sometime, I will try to get a better perspective of my life.\n\nJust for today I will be unafraid.\nEspecially I will not be afraid to enjoy what is beautiful\nand to believe that as I give to the world, so the world will give to me.",
  },
];
