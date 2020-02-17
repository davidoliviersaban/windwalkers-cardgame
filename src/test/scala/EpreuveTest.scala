import org.scalatest.FunSuite

class EpreuveTest extends FunSuite {

  test("Sorted Epreuve") {
    val epreuve = new SortedEpreuve(6, 5)
    val jet = epreuve.diceRoll()
    println (s"Objectif: ${epreuve.epreuves(1)}")
    for (i <- 1 to 6) {
      val res = ManipulateDice.set1(jet,epreuve.epreuves(1))
      println (s"Mon jet s'ameliore: ${jet}")
    }
    assert(epreuve.wind(6, 1, jet))
  }
}
