import java.util.function.BiConsumer

import scala.collection.mutable

class Team(size: Int) {

}


class Epreuve(dicesToRoll : Int, tiles : Int) {
  val epreuves = {
    var values = Seq[Dices]()
    for (i <- 0 to tiles) values :+= diceRoll()
    values
  }
  def diceRoll() : Dices =  new Dices(dicesToRoll)

  def wind(force: Int, tile: Int, monJet: Dices) = {
    monJet.matches(epreuves(tile),force)
  }

  def test(team: Int,function: BiConsumer[Dices,Dices]): (Int,Int) = {
    for (force <- 1 to 6) {
      var capacity = team
      for (tile <- 1 to tiles)
      {
        val monJet = diceRoll()
        for (perso <- 1 to team) {
            if (capacity > 0 && ! wind(force,tile,monJet)) {
              function.accept(monJet,epreuves(tile))
              capacity-=1
          }
        }
        if (! wind(force,tile,monJet)) {
          return (force,tile)
        }
      }
    }
    (6,6)
  }
}


class SortedEpreuve(dicesToRoll : Int, tiles: Int) extends Epreuve(dicesToRoll, tiles) {
  override def diceRoll(): Dices = {new SortedDices(dicesToRoll)}
}


case object Main extends App {

  def simulation(methode: String, biConsumer: BiConsumer[Dices,Dices]) = {
    var avg : mutable.Seq[Double] = mutable.Seq[Double](0,0)
    for (i <- 1 to evaluations) {
      val epreuve = new SortedEpreuve(dicesToRoll, tiles)
      val res = epreuve.test(team,biConsumer)
      avg(0) += res._1
      avg(1) += res._2
    }
    avg(0) /= evaluations
    avg(1) /= evaluations
    println(s"${methode} J'ai echoue en moyenne au vent force: ${avg(0)}, palier: ${avg(1)}")
  }

  val dicesToRoll = 6
  val evaluations = 1000
  val team = 6
  val tiles = 5

  simulation("Add",ManipulateDice.add1)
  simulation("Minus",ManipulateDice.minus1)
  simulation("Reverse",ManipulateDice.reverse1)
  simulation("AddOrMinus",ManipulateDice.addOrminus1)
  simulation("AddMinus",ManipulateDice.add1minus1)
  simulation("ReRoll",ManipulateDice.reroll1)
  simulation("Set",ManipulateDice.set1)

}
