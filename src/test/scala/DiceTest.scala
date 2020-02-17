import org.scalatest._

class DiceTest extends FunSuite {

  test("Roll one Die") {
    val result = new Dices(1).rollOne()
    assert(result >= 1)
    assert(result <= 6)
  }

  test("Roll lots of Dices") {
    val result = new SortedDices(100).roll()
    assert(result(0) == 1)
    assert(result(99) == 6)
  }

  test("Validate matching dices") {
    val dicesToMatch = new Dices(6)
    val dices = new Dices(6)

    assert(dices.matches(dicesToMatch,0))
    for (seq <- 1 to 6) {
      assert(dicesToMatch.matches(dicesToMatch,seq))
    }
    dices.set(Seq[Int](dicesToMatch.get(0),0,dicesToMatch.get(2),0,dicesToMatch.get(4),0).toArray)
    assert(dices.matching(dices).contains(0))
    assert(dices.matching(dices).contains(2))
    assert(dices.matching(dices).contains(4))
    for (seq <- 1 to 3) {
      assert(dices.matches(dicesToMatch,seq))
    }
    for (seq <- 4 to 6) {
      assert(dices.matches(dicesToMatch,seq) == false)
    }
  }

  test("Validate matching sorted dices") {
    val dicesToMatch = new SortedDices(6)
    val dices = new SortedDices(6)

    assert(dices.matches(dicesToMatch,0))
    for (seq <- 1 to 6) {
      assert(dicesToMatch.matches(dicesToMatch,seq))
    }
    dices.set(Seq[Int](dicesToMatch.get(0),0,dicesToMatch.get(2),0,dicesToMatch.get(4),0).sorted.toArray)
    // Check updates worked fine
    assert(dices.matching(dices).contains((0,0)))
    assert(dices.matching(dices).contains((2,2)))
    assert(dices.matching(dices).contains((4,4)))

    for (seq <- 1 to 3) {
      assert(dices.matches(dicesToMatch,seq))
    }
    for (seq <- 4 to 6) {
      assert(dices.matches(dicesToMatch,seq) == false)
    }
  }

  test("Validate Reroll dices") {
    val dicesToMatch = new Dices(6)
    val dices = new Dices(6)
    dices.set(dicesToMatch.results.toSeq.toArray)
    assert(dices.matches(dicesToMatch,6))

    dices.reroll(0,1,2,3)
    println (dicesToMatch)
    println (dices)
    assert(dices.matches(dicesToMatch,2))
    assert(dices.matches(dicesToMatch,6) == false)
  }

  test("Validate matching algorithm for SortedDices") {
    val dicesToMatch = new SortedDices(6)
    val dices = new SortedDices(6)
    for (i <- 0 to 5) {
      dices.set(i,0)
    }
    for (i <- 0 to 5) {
      println(s"${dices.matching(dicesToMatch).size} for $dices and $dicesToMatch")
      dices.set(0, dicesToMatch.get(i))
    }
    println(s"${dices.matching(dicesToMatch)}")
  }

}
