import scala.util.Random

class Dices(nbdices : Int) {
  def nbDices() = nbdices
  protected var result: Array[Int] = roll()

  def results() = result

  def rollOne() = {
    Random.nextInt(6)+1
  }

  def roll() = {
    result = Array[Int]()
    for (loops <- 1 to nbdices) {
      result :+= rollOne()
    }
    result
  }

  override def toString() : String = {
    result.mkString(",")
  }

  def matching(dices : Dices): Seq[Any] = {
    var matched = Seq[Int]()
    for (seq <- 0 to nbdices-1) {
      if (result(seq) == dices.result(seq)) matched :+= seq
    }
    matched
  }

  def matches(dices : Dices, depth : Int) = {
    matching(dices).size >= depth
  }

  def set(input: Array[Int]) = { result = input.toSeq.toArray }

  def reroll(indices : Int*) = {
    for (i <- indices) result(i) = rollOne()
  }

  def ++(indices : Int*) = {
    for (id <- indices) result(id)+=1
  }

  def --(indices : Int*) = {
    for (id <- indices) result(id)-=1
  }

  def r(indices : Int*) = {
    for (id <- indices) result(id)  = 7 - result(id)
  }

  def set(indice: Int, value: Int): Unit = {
    result(indice) = value
  }
  def get(value: Int): Int = result(value)

}


class SortedDices(nbdices : Int) extends Dices(nbdices : Int)  {

  override def roll() = {
    result = super.roll().sorted
    result
  }

  /**
   * Compares the rolled dices from the class with the ones passed as parameter
   * @param dices
   * @return list of ids of matching dices in pair. First value of the pair being the id of the die from this class and
   *         the Second value being the one from external roll
   */
  override def matching(dices: Dices) = {
    var matched = Seq[(Int,Int)]()
    var seq1 = 0
    var seq2 = 0
    val sortedResult2 = dices.results
    val sortedResult1 = results
    while (seq1 < nbdices && seq2 < nbdices) {
      if (sortedResult1(seq1) == sortedResult2(seq2))  {
        matched :+= (seq1,seq2)
        seq1 += 1
        seq2 += 1
      }
      else if (sortedResult1(seq1) < sortedResult2(seq2)) {
        seq1 += 1
      }
      else {
        seq2 += 1
      }
    }
    matched
  }

}
