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
    id: "just-for-today",
    title: "Just for Today",
    text: "Just for today I will try to live through this day only, and not tackle my whole life problem at once.\n\nJust for today I will be happy. This assumes to be true what Abraham Lincoln said, that \"most folks are as happy as they make up their minds to be.\"\n\nJust for today I will adjust myself to what is and not try to adjust everything to my own desires.\n\nJust for today I will try to strengthen my mind. I will study. I will learn something useful. I will not be a mental loafer. I will read something that requires effort, thought, and concentration.\n\nJust for today I will exercise my soul in three ways: I will do somebody a good turn and not get found out. I will do at least two things I don't want to do, just for exercise.\n\nJust for today I will be agreeable. I will look as well as I can, dress becomingly, talk low, act courteously, criticize not one bit, not find fault with anything, and not try to improve or regulate anybody except myself.\n\nJust for today I will have a program. I may not follow it exactly, but I will have it. I will save myself from two pests: hurry and indecision.\n\nJust for today I will have a quiet half hour all by myself and relax. During this half hour, sometime, I will try to get a better perspective of my life.\n\nJust for today I will be unafraid. Especially I will not be afraid to enjoy what is beautiful and to believe that as I give to the world, so the world will give to me.",
  },
  {
    id: "serenity",
    title: "Serenity Prayer",
    text: "God, grant me the serenity\nto accept the things I cannot change,\ncourage to change the things I can,\nand wisdom to know the difference.",
    source: "Reinhold Niebuhr",
  },
  {
    id: "st-francis",
    title: "Prayer of St. Francis",
    text: "Lord, make me a channel of Your peace\nthat where there is hatred, I may bring love\nthat where there is wrong, I may bring the spirit of forgiveness\nthat where there is discord, I may bring harmony\nthat where there is error, I may bring truth\nthat where there is doubt, I may bring faith\nthat where there is despair, I may bring hope\nthat where there are shadows, I may bring light\nthat where there is sadness, I may bring joy.\n\nLord, grant that I may seek rather to comfort than to be comforted\nto understand, than to be understood\nto love, than to be loved.\nFor it is by self-forgetting that one finds\nIt is by forgiving that one is forgiven\nIt is by dying that one awakens to eternal life.\n\nAmen.",
    source: "St. Francis of Assisi",
  },
  {
    id: "third-step",
    title: "Third Step Prayer",
    text: "God, I offer myself to Thee — to build with me and to do with me as Thou wilt. Relieve me of the bondage of self, that I may better do Thy will. Take away my difficulties, that victory over them may bear witness to those I would help of Thy Power, Thy Love, and Thy Way of life. May I do Thy will always!\n\nAmen.",
  },
  {
    id: "seventh-step",
    title: "Seventh Step Prayer",
    text: "My Creator, I am now willing that you should have all of me, good and bad. I pray that you now remove from me every single defect of character which stands in the way of my usefulness to you and my fellows. Grant me strength, as I go out from here, to do your bidding.\n\nAmen.",
  },
  {
    id: "let-go",
    title: "Let Go and Let God",
    text: "To \"let go\" does not mean to stop caring, it means I can't do it for someone else.\n\nTo \"let go\" is not to cut myself off, it's the realization I can't control another.\n\nTo \"let go\" is not to enable, but to allow learning from natural consequences.\n\nTo \"let go\" is to admit powerlessness, which means the outcome is not in my hands.\n\nTo \"let go\" is not to try to change or blame another, it's to make the most of myself.\n\nTo \"let go\" is not to care for, but to care about.\n\nTo \"let go\" is not to fix, but to be supportive.\n\nTo \"let go\" is not to judge, but to allow another to be a human being.\n\nTo \"let go\" is not to be in the middle arranging all the outcomes, but to allow others to affect their own destinies.\n\nTo \"let go\" is not to deny, but to accept.\n\nTo \"let go\" is not to nag, scold, or argue, but instead to search out my own shortcomings and correct them.\n\nTo \"let go\" is not to criticize and regulate anybody, but to try to become what I dream I can be.\n\nTo \"let go\" is to fear less and to love more.",
  },
  {
    id: "just-for-tonight",
    title: "Just for Tonight",
    text: "Just for tonight, I will be grateful. I will give thanks for the past day — its failures as well as its successes, its sadness as well as its joy and its pain as well as its pleasure. I will take comfort in knowing that every event and circumstance that occurred today can be used for my good and the good of others.\n\nJust for tonight, I will accept that I have done the best I could, remembering that my goal is spiritual progress and not perfection. I will let go of any expectation I had for this day, as well as any disappointment, shame or guilt I felt for not being perfect today.\n\nJust for tonight, I will be humble. I will give my shortcomings to a Power greater than myself, trusting that doing so can bring about changes in me that I could not bring about by myself.\n\nJust for tonight, I will not attempt to rectify today's mistakes or solve tomorrow's problems. I will remind myself that I am better able to receive guidance when my mind and body are rested and refreshed.\n\nJust for tonight, I will set aside my fears, frustrations and aspirations and take a few minutes to review the abundance that exists in my life today. I will place my future in the care of a loving God of my own understanding, trusting my needs will be met at a time and in a way that is best for all concerned.",
  },
];
